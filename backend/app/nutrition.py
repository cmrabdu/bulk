"""Calculs nutritionnels : objectifs (Mifflin-St Jeor), état des barres, helpers temps."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from .config import settings
from .models import User


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def local_day(dt: datetime) -> str:
    """Date locale (fuseau configuré) au format YYYY-MM-DD."""
    return dt.astimezone(ZoneInfo(settings.tz)).date().isoformat()


def today_str() -> str:
    return local_day(now_utc())


def bmr(u: User) -> float:
    """Métabolisme de base — Mifflin-St Jeor."""
    base = 10.0 * u.weight_kg + 6.25 * u.height_cm - 5.0 * u.age
    return base + (5.0 if u.sex == "m" else -161.0)


def target_kcal_base(u: User) -> int:
    """TDEE estimé (dépense totale) = BMR x facteur d'activité.

    Sera remplacé par le TDEE réel Fitbit du jour quand l'intégration sera active.
    """
    return round(bmr(u) * u.activity_factor)


def target_kcal_final(u: User) -> int:
    """Objectif kcal du jour = TDEE + surplus prise de masse (ou surcharge manuelle)."""
    if u.target_kcal_override:
        return int(u.target_kcal_override)
    return round(target_kcal_base(u) * (1.0 + u.surplus_pct / 100.0))


def target_protein(u: User) -> int:
    """Objectif protéines = poids x coefficient (ou surcharge manuelle)."""
    if u.target_protein_override:
        return int(u.target_protein_override)
    return round(u.weight_kg * u.protein_coef_g_per_kg)


def progress_state(total: float, target: float, alert_over: bool = True) -> str:
    """État d'une barre : under < on_track < reached, et over (alerte "trop") pour les kcal.

    `alert_over=False` pour les protéines : en dépasser n'est pas un problème.
    """
    if target <= 0:
        return "under"
    pct = total / target * 100.0
    if alert_over and total > target * 1.10:
        return "over"
    if pct >= 100.0:
        return "reached"
    if pct >= 50.0:
        return "on_track"
    return "under"


def pct_of(total: float, target: float) -> int:
    if target <= 0:
        return 0
    return round(total / target * 100.0)
