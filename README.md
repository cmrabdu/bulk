# Bulk

Tracker de nutrition gamifié pour la prise de masse. Macros + kcal du jour affichés
en **barres de progression** (rouge → vert), objectif kcal ajusté au TDEE (Mifflin-St
Jeor, puis TDEE réel Fitbit plus tard). Mono-utilisateur, self-hosted.

> Nom de travail — susceptible d'être renommé.

## Stack
- **Backend** : FastAPI + SQLAlchemy + SQLite (1 worker uvicorn).
- **Frontend** : React + TypeScript + Vite (mobile-first, thème sombre), servi par nginx.
- **Proxy** : Caddy (`bulk.cmrabdu.com`, `/api/*` → backend, reste → SPA).
- **Données alimentaires** : OpenFoodFacts (recherche + code-barres).
- **Auth** : mono-utilisateur, login stylisé + cookie de session signé (JWT).

## Structure
```
backend/    FastAPI (app/, tests/, Dockerfile)
frontend/   Vite React TS (src/, Dockerfile, nginx.conf)
deploy/     DEPLOY.md + snippet Caddy
design/     handoff pour Claude Design (UI)
docker-compose.yml
```

## Dev local
```bash
# backend
cd backend && python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=sqlite:///./bulk.db SESSION_SECRET=dev APP_PASSWORD=dev \
  uvicorn app.main:app --reload --port 8798

# frontend (autre terminal) — proxie /api vers :8798
cd frontend && npm install && npm run dev
```
Tests backend : `cd backend && pytest`.

## Déploiement
Voir [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

## État
- ✅ Backend complet (settings, journal, recherche/code-barres OFF, résumé/barres, historique, auth, stub Fitbit).
- ✅ Frontend **de référence** fonctionnel (câblé à l'API).
- ⏳ Design final (UI + barres gamifiées polies + login stylisé) via Claude Design — voir [`design/`](design/).
- ⏳ OAuth Fitbit réel (à brancher une fois en HTTPS).

## Licence
MIT.
