"""Client OpenFoodFacts : recherche texte + lookup code-barres, normalisés en `FoodHit`.

OFF est instable : `cgi/search.pl` renvoie par intermittence des pages d'erreur HTML
(429/5xx) au lieu du JSON. On encaisse ça avec : (1) retries + backoff, (2) validation
stricte (status 200 + content-type JSON), (3) cache des recherches réussies servi même
périmé quand OFF flanche. On ne garde que les produits avec kcal + protéines /100 g.
"""
import asyncio
import time
from typing import Optional

import httpx

from .config import settings
from .schemas import FoodHit, Per100g

FIELDS = (
    "code,product_name,product_name_fr,generic_name,brands,"
    "image_small_url,image_url,nutriments,serving_quantity,nutriscore_grade"
)

_client = httpx.AsyncClient(timeout=12.0, headers={"User-Agent": settings.off_user_agent})

# Cache mémoire : code-barres (par code) et recherches (par "q|page").
_barcode_cache: dict[str, tuple[float, Optional[FoodHit]]] = {}
_search_cache: dict[str, tuple[float, list[FoodHit]]] = {}
_CACHE_TTL = 86400.0        # code-barres : 24 h
_SEARCH_TTL = 600.0         # recherche : 10 min (frais) ; sert plus vieux en secours


def _json_or_none(r: httpx.Response) -> Optional[dict]:
    """Renvoie le JSON seulement si OFF a répondu proprement (sinon page d'erreur HTML)."""
    ct = r.headers.get("content-type", "")
    if r.status_code == 200 and ct.startswith("application/json"):
        try:
            return r.json()
        except ValueError:
            return None
    return None


async def _get_json(url: str, params: dict, attempts: int = 6) -> Optional[dict]:
    for i in range(attempts):
        try:
            r = await _client.get(url, params=params)
            data = _json_or_none(r)
            if data is not None:
                return data
        except httpx.HTTPError:
            pass
        await asyncio.sleep(min(0.4 * (i + 1), 1.5))  # backoff court
    return None


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
    key = f"{q.lower().strip()}|{page}"
    now = time.time()
    cached = _search_cache.get(key)
    if cached and now - cached[0] < _SEARCH_TTL:
        return cached[1]

    data = await _get_json(
        f"{settings.off_base}/cgi/search.pl",
        {
            "search_terms": q,
            "search_simple": 1,
            "action": "process",
            "json": 1,
            "page_size": 20,
            "page": max(1, page),
            "fields": FIELDS,
            "sort_by": "unique_scans_n",  # les plus scannés d'abord (popularité)
        },
    )
    if data is None:
        # OFF a flanché : sert le cache même périmé plutôt que rien.
        return cached[1] if cached else []

    out = [h for h in (_normalize(p) for p in data.get("products", [])) if h]
    if out:
        _search_cache[key] = (now, out)
    return out


async def barcode(code: str) -> Optional[FoodHit]:
    now = time.time()
    cached = _barcode_cache.get(code)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    url = f"{settings.off_base}/api/v2/product/{code}.json"
    for i in range(5):
        try:
            r = await _client.get(url, params={"fields": FIELDS})
            if r.status_code == 404:
                _barcode_cache[code] = (now, None)
                return None
            data = _json_or_none(r)
            if data is not None:
                result = None if (data.get("status") == 0 or "product" not in data) else _normalize(data["product"])
                _barcode_cache[code] = (now, result)
                return result
        except httpx.HTTPError:
            pass
        await asyncio.sleep(min(0.4 * (i + 1), 1.5))
    raise RuntimeError("OpenFoodFacts indisponible")
