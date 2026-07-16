"""Configuration centralisée (12-factor : tout par variables d'environnement).

En prod les valeurs sont fournies par docker-compose (`environment:`) et le fichier
`backend/.env` (secrets, non commité). Les défauts ci-dessous ne servent qu'au dev local.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"

    # SQLite : un seul fichier, monté en volume en prod (/app/data/bulk.db).
    database_url: str = "sqlite:////app/data/bulk.db"

    # --- Auth (mono-utilisateur, gate applicative stylisée) ---
    session_secret: str = "dev-insecure-change-me"   # OBLIGATOIRE de surcharger en prod
    app_username: str = "abdullah"
    app_password: str = "prisedemasse"
    token_ttl_days: int = 30
    cookie_secure: bool = False   # True en prod (HTTPS)

    # Frontière "aujourd'hui" = minuit dans ce fuseau.
    tz: str = "Europe/Paris"

    # OpenFoodFacts : UA obligatoire (leur politique d'accès l'exige).
    off_base: str = "https://world.openfoodfacts.org"
    off_user_agent: str = "Bulk/1.0 (personal nutrition tracker; contact camurabdu@gmail.com)"

    public_base_url: str = "http://localhost:5173"


settings = Settings()
