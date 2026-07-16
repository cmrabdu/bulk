"""Profil & objectifs (GET/PUT /api/settings)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..db import get_db
from ..models import User
from ..nutrition import target_kcal_base, target_kcal_final, target_protein
from ..schemas import SettingsIn, SettingsOut

router = APIRouter(prefix="/api", tags=["settings"], dependencies=[Depends(require_auth)])

USER_ID = 1


def _get_user(db: Session) -> User:
    user = db.get(User, USER_ID)
    if user is None:  # filet de sécurité : le seed le crée au démarrage
        user = User(id=USER_ID)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _to_out(u: User) -> SettingsOut:
    return SettingsOut(
        name=u.name,
        weight_kg=u.weight_kg,
        height_cm=u.height_cm,
        age=u.age,
        sex=u.sex,
        activity_factor=u.activity_factor,
        protein_coef_g_per_kg=u.protein_coef_g_per_kg,
        surplus_pct=u.surplus_pct,
        target_protein_g=target_protein(u),
        target_kcal_base=target_kcal_base(u),
        target_kcal_final=target_kcal_final(u),
        target_protein_override=u.target_protein_override,
        target_kcal_override=u.target_kcal_override,
        use_fitbit=u.use_fitbit,
    )


@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _to_out(_get_user(db))


@router.put("/settings", response_model=SettingsOut)
def update_settings(body: SettingsIn, db: Session = Depends(get_db)):
    user = _get_user(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return _to_out(user)
