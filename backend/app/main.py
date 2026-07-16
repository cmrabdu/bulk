"""Point d'entrée FastAPI : création du schéma, seed mono-utilisateur, routes."""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .db import Base, SessionLocal, engine
from .models import User
from .routers import auth, entries, fitbit, food, settings, summary


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # SQLite : create_all suffit en V1 (mono-utilisateur, pas de migrations lourdes).
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.get(User, 1) is None:
            db.add(User(id=1))  # profil par défaut (modifiable dans Réglages)
            db.commit()
    finally:
        db.close()
    yield


app = FastAPI(title="Bulk API", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    # Sondé par le HEALTHCHECK Docker (interne au conteneur, hors Caddy).
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(settings.router)
app.include_router(food.router)
app.include_router(entries.router)
app.include_router(summary.router)
app.include_router(fitbit.router)
