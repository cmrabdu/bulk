"""Progression du jour (alimente les barres) + historique."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import FoodEntry, User
from ..nutrition import (
    pct_of,
    progress_state,
    target_kcal_final,
    target_protein,
    today_str,
)
from ..schemas import DaySummaryOut, ProgressOut, SummaryOut

router = APIRouter(prefix="/api", tags=["summary"], dependencies=[Depends(require_auth)])

USER_ID = 1


def _get_user(db: Session) -> User:
    user = db.get(User, USER_ID)
    if user is None:
        user = User(id=USER_ID)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _totals(db: Session, day: str) -> tuple[float, float, int]:
    row = db.execute(
        select(
            func.coalesce(func.sum(FoodEntry.kcal), 0.0),
            func.coalesce(func.sum(FoodEntry.protein_g), 0.0),
            func.count(FoodEntry.id),
        ).where(FoodEntry.user_id == USER_ID, FoodEntry.day == day)
    ).one()
    return float(row[0]), float(row[1]), int(row[2])


@router.get("/summary/today", response_model=SummaryOut)
def summary_today(date: str | None = None, db: Session = Depends(get_db)):
    user = _get_user(db)
    day = date or today_str()
    kcal_total, prot_total, count = _totals(db, day)

    kcal_target = target_kcal_final(user)
    prot_target = target_protein(user)

    return SummaryOut(
        date=day,
        kcal=ProgressOut(
            total=kcal_total,
            target=kcal_target,
            pct=pct_of(kcal_total, kcal_target),
            state=progress_state(kcal_total, kcal_target, alert_over=True),
        ),
        protein=ProgressOut(
            total=prot_total,
            target=prot_target,
            pct=pct_of(prot_total, prot_target),
            state=progress_state(prot_total, prot_target, alert_over=False),
        ),
        tdee_source="fitbit" if user.use_fitbit else "estimate",
        entries_count=count,
    )


@router.get("/history", response_model=list[DaySummaryOut])
def history(db: Session = Depends(get_db)):
    """Résumé par jour (max ~90 derniers jours renseignés) pour la liste ✅/⚠️."""
    user = _get_user(db)
    kcal_target = target_kcal_final(user)
    prot_target = target_protein(user)

    rows = db.execute(
        select(
            FoodEntry.day,
            func.coalesce(func.sum(FoodEntry.kcal), 0.0),
            func.coalesce(func.sum(FoodEntry.protein_g), 0.0),
        )
        .where(FoodEntry.user_id == USER_ID)
        .group_by(FoodEntry.day)
        .order_by(FoodEntry.day.desc())
        .limit(90)
    ).all()

    out: list[DaySummaryOut] = []
    for day, kcal_total, prot_total in rows:
        out.append(
            DaySummaryOut(
                date=day,
                kcal_total=float(kcal_total),
                kcal_target=kcal_target,
                protein_total=float(prot_total),
                protein_target=prot_target,
                # "atteint" = dans une fenêtre raisonnable (kcal) / objectif protéines franchi.
                kcal_ok=(kcal_target * 0.9 <= float(kcal_total) <= kcal_target * 1.1),
                protein_ok=(float(prot_total) >= prot_target),
            )
        )
    return out
