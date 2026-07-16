"""Journal alimentaire : ajout, liste du jour, édition, suppression."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import FoodEntry
from ..nutrition import local_day, now_utc, today_str
from ..schemas import EntriesOut, EntryOut, EntryPatch, NewEntry

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(require_auth)])

USER_ID = 1


def _resolve_macros(body: NewEntry) -> tuple[float, float]:
    """Calcule kcal + protéines finales pour la quantité saisie.

    - g/ml + per_100g  -> valeur pour 100 g x (quantité / 100)
    - manual           -> valeur (par portion/unité) x quantité
    """
    if body.manual is not None:
        factor = body.quantity if body.quantity else 1.0
        return round(body.manual.kcal * factor), round(body.manual.protein_g * factor, 1)
    if body.per_100g is not None:
        factor = body.quantity / 100.0
        return round(body.per_100g.kcal * factor), round(body.per_100g.protein_g * factor, 1)
    raise HTTPException(status_code=422, detail="il faut fournir per_100g ou manual")


@router.post("", response_model=EntryOut)
def create_entry(body: NewEntry, db: Session = Depends(get_db)):
    kcal, protein = _resolve_macros(body)
    now = now_utc()
    entry = FoodEntry(
        user_id=USER_ID,
        name=body.name.strip(),
        quantity=body.quantity,
        unit=body.unit,
        kcal=kcal,
        protein_g=protein,
        off_id=body.off_id,
        logged_at=now,
        day=local_day(now),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=EntriesOut)
def list_entries(date: str | None = None, db: Session = Depends(get_db)):
    day = date or today_str()
    rows = db.scalars(
        select(FoodEntry)
        .where(FoodEntry.user_id == USER_ID, FoodEntry.day == day)
        .order_by(FoodEntry.logged_at.asc())
    ).all()
    return EntriesOut(date=day, entries=list(rows))


@router.patch("/{entry_id}", response_model=EntryOut)
def patch_entry(entry_id: int, body: EntryPatch, db: Session = Depends(get_db)):
    entry = db.get(FoodEntry, entry_id)
    if entry is None or entry.user_id != USER_ID:
        raise HTTPException(status_code=404, detail="entrée introuvable")
    if body.name is not None:
        entry.name = body.name.strip()
    if body.quantity is not None and body.quantity > 0 and entry.quantity > 0:
        # kcal/protéines sont linéaires en quantité -> simple mise à l'échelle.
        ratio = body.quantity / entry.quantity
        entry.kcal = round(entry.kcal * ratio)
        entry.protein_g = round(entry.protein_g * ratio, 1)
        entry.quantity = body.quantity
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(FoodEntry, entry_id)
    if entry is None or entry.user_id != USER_ID:
        raise HTTPException(status_code=404, detail="entrée introuvable")
    db.delete(entry)
    db.commit()
