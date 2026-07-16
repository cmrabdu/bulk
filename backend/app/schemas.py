"""Schémas Pydantic = le contrat d'API (identique à celui donné à Claude Design)."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


# --- Settings ---
class SettingsIn(BaseModel):
    name: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    age: Optional[int] = None
    sex: Optional[Literal["m", "f"]] = None
    activity_factor: Optional[float] = None
    protein_coef_g_per_kg: Optional[float] = None
    surplus_pct: Optional[float] = None
    target_protein_override: Optional[int] = None
    target_kcal_override: Optional[int] = None


class SettingsOut(BaseModel):
    name: str
    weight_kg: float
    height_cm: float
    age: int
    sex: str
    activity_factor: float
    protein_coef_g_per_kg: float
    surplus_pct: float
    target_protein_g: int          # objectif effectif (surcharge ou calculé)
    target_kcal_base: int          # TDEE estimé (BMR x activité)
    target_kcal_final: int         # objectif du jour = base x (1+surplus) ou surcharge
    target_protein_override: Optional[int] = None
    target_kcal_override: Optional[int] = None
    use_fitbit: bool


# --- Food (OpenFoodFacts) ---
class Per100g(BaseModel):
    kcal: float
    protein_g: float


class FoodHit(BaseModel):
    source: str = "off"
    off_id: str
    name: str
    brand: Optional[str] = None
    image_url: Optional[str] = None
    per_100g: Per100g
    serving_size_g: Optional[float] = None
    nutriscore: Optional[str] = None


class FoodSearchOut(BaseModel):
    results: list[FoodHit]


# --- Entries ---
class NewEntry(BaseModel):
    name: str
    quantity: float
    unit: Literal["g", "ml", "portion"]
    off_id: Optional[str] = None
    per_100g: Optional[Per100g] = None   # aliment g/ml -> serveur calcule x quantité/100
    manual: Optional[Per100g] = None     # saisie manuelle -> serveur calcule x quantité


class EntryPatch(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None


class EntryOut(BaseModel):
    # from_attributes : permet de construire EntryOut directement depuis un objet ORM
    # FoodEntry (indispensable pour EntriesOut(entries=[...ORM...]) côté GET /entries).
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    quantity: float
    unit: str
    kcal: float
    protein_g: float
    off_id: Optional[str] = None
    logged_at: datetime


class EntriesOut(BaseModel):
    date: str
    entries: list[EntryOut]


# --- Summary / history ---
class ProgressOut(BaseModel):
    total: float
    target: int
    pct: int
    state: str


class SummaryOut(BaseModel):
    date: str
    kcal: ProgressOut
    protein: ProgressOut
    tdee_source: str
    entries_count: int


class DaySummaryOut(BaseModel):
    date: str
    kcal_total: float
    kcal_target: int
    protein_total: float
    protein_target: int
    kcal_ok: bool
    protein_ok: bool


# --- Auth ---
class LoginIn(BaseModel):
    username: str
    password: str
