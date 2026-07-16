"""Client OpenFoodFacts : recherche texte + lookup code-barres, normalisés en `FoodHit`.

On ne garde que ce dont l'app a besoin : kcal + protéines pour 100 g. Les produits sans
ces valeurs sont écartés (inutiles pour le tracking). Cache mémoire court sur les codes-barres.
"""
import time
from typing import Optional

import httpx

from .config import settings
from .schemas import FoodHit, Per100g

FIELDS = (
    "code,product_name,product_name_fr,generic_name,brands,"
    "image_small_url,image_url,nutriments,serving_quantity,nutriscore_grade"
)

_client = httpx.AsyncClient(timeout=10.0, headers={"User-Agent": settings.off_user_agent})

# Cache mémoire des codes-barres (OFF est parfois lent / limité).
_barcode_cache: dict[str, tuple[float, Optional[FoodHit]]] = {}
_CACHE_TTL = 86400.0


def _kcal_per_100g(nutr: dict) -> Optional[float]:
    v = nutr.get("energy-kcal_100g")
    if v is None:
        kj = nutr.get("energy_100g") or nutr.get("energy-kj_100g")
        if kj is None:
            return None
        try:
            return round(float(kj) / 4.184, 1)  # kJ -> kcal
        except (TypeError, ValueError):
            return None
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return None


def _normalize(p: dict) -> Optional[FoodHit]:
    code = p.get("code")
    name = p.get("product_name") or p.get("product_name_fr") or p.get("generic_name")
    nutr = p.get("nutriments") or {}
    kcal = _kcal_per_100g(nutr)
    prot = nutr.get("proteins_100g")
    if not code or not name or kcal is None or prot is None:
        return None
    try:
        prot = round(float(prot), 1)
    except (TypeError, ValueError):
        return None

    serving = p.get("serving_quantity")
    try:
        serving = float(serving) if serving not in (None, "") else None
    except (TypeError, ValueError):
        serving = None

    return FoodHit(
        off_id=str(code),
        name=name.strip(),
        brand=(p.get("brands") or None),
        image_url=(p.get("image_small_url") or p.get("image_url") or None),
        per_100g=Per100g(kcal=kcal, protein_g=prot),
        serving_size_g=serving,
        nutriscore=(p.get("nutriscore_grade") or None),
    )


async def search(q: str, page: int = 1) -> list[FoodHit]:
    # Recherche plein-texte via l'endpoint legacy cgi/search.pl : l'API v2 /search ne fait
    # pas de full-text fiable (renvoie parfois du non-JSON). Le lookup code-barres, lui,
    # utilise bien l'API v2 (voir barcode()).
    url = f"{settings.off_base}/cgi/search.pl"
    params = {
        "search_terms": q,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 20,
        "page": max(1, page),
        "fields": FIELDS,
        "sort_by": "unique_scans_n",  # les plus scannés d'abord (popularité)
    }
    r = await _client.get(url, params=params)
    r.raise_for_status()
    data = r.json()
    out: list[FoodHit] = []
    for p in data.get("products", []):
        hit = _normalize(p)
        if hit:
            out.append(hit)
    return out


async def barcode(code: str) -> Optional[FoodHit]:
    cached = _barcode_cache.get(code)
    now = time.time()
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    url = f"{settings.off_base}/api/v2/product/{code}.json"
    r = await _client.get(url, params={"fields": FIELDS})
    if r.status_code == 404:
        _barcode_cache[code] = (now, None)
        return None
    r.raise_for_status()
    data = r.json()
    if data.get("status") == 0 or "product" not in data:
        _barcode_cache[code] = (now, None)
        return None

    result = _normalize(data["product"])
    _barcode_cache[code] = (now, result)
    return result
