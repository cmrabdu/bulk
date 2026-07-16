"""Modèle de données. Mono-utilisateur en V1 : une seule ligne `users` (id=1).

`daily_summary` de la spec initiale est volontairement absent : l'historique est
recalculé à la volée depuis `food_entries` + les objectifs courants (pas de table
morte à maintenir). Les colonnes fitbit_* existent mais restent inutilisées tant que
l'OAuth Fitbit n'est pas branché.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, default="Abdullah")
    weight_kg: Mapped[float] = mapped_column(Float, default=80.0)
    height_cm: Mapped[float] = mapped_column(Float, default=178.0)
    age: Mapped[int] = mapped_column(Integer, default=25)
    sex: Mapped[str] = mapped_column(String, default="m")  # "m" | "f"
    activity_factor: Mapped[float] = mapped_column(Float, default=1.5)
    protein_coef_g_per_kg: Mapped[float] = mapped_column(Float, default=2.0)
    surplus_pct: Mapped[float] = mapped_column(Float, default=10.0)

    # Surcharges manuelles des objectifs (NULL = calculé automatiquement).
    target_protein_override: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_kcal_override: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Fitbit (branché plus tard).
    use_fitbit: Mapped[bool] = mapped_column(Boolean, default=False)
    fitbit_access_token: Mapped[str | None] = mapped_column(String, nullable=True)
    fitbit_refresh_token: Mapped[str | None] = mapped_column(String, nullable=True)


class FoodEntry(Base):
    __tablename__ = "food_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, default=1, index=True)
    name: Mapped[str] = mapped_column(String)
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String)  # g | ml | portion
    # kcal / protein_g = valeurs finales résolues pour CETTE quantité (snapshot figé,
    # stable même si OpenFoodFacts change ses données plus tard).
    kcal: Mapped[float] = mapped_column(Float)
    protein_g: Mapped[float] = mapped_column(Float)
    off_id: Mapped[str | None] = mapped_column(String, nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    day: Mapped[str] = mapped_column(String, index=True)  # date locale YYYY-MM-DD
