"""Proxy OpenFoodFacts (recherche + code-barres)."""
from fastapi import APIRouter, Depends, HTTPException, Query

from .. import openfoodfacts as off
from ..auth import require_auth
from ..schemas import FoodHit, FoodSearchOut

router = APIRouter(prefix="/api/food", tags=["food"], dependencies=[Depends(require_auth)])


@router.get("/search", response_model=FoodSearchOut)
async def food_search(q: str = Query(..., min_length=1), page: int = 1):
    try:
        results = await off.search(q, page)
    except Exception:  # OFF indisponible / lent : on renvoie vide plutôt que 500
        results = []
    return FoodSearchOut(results=results)


@router.get("/barcode/{code}", response_model=FoodHit)
async def food_barcode(code: str):
    try:
        hit = await off.barcode(code)
    except Exception:
        raise HTTPException(status_code=502, detail="OpenFoodFacts indisponible")
    if hit is None:
        raise HTTPException(status_code=404, detail="produit introuvable")
    return hit
