"""Auth mono-utilisateur : login stylisé (cookie de session signé JWT).

Simple par design : un seul compte (identifiants en variables d'env), un cookie
httpOnly signé. Pas de table de sessions, pas de gestion multi-utilisateurs.
"""
import hmac
from datetime import timedelta

import jwt
from fastapi import HTTPException, Request, Response

from .config import settings
from .nutrition import now_utc

COOKIE = "bulk_session"


def verify_credentials(username: str, password: str) -> bool:
    ok_user = hmac.compare_digest(username, settings.app_username)
    ok_pass = hmac.compare_digest(password, settings.app_password)
    return ok_user and ok_pass


def make_token() -> str:
    exp = now_utc() + timedelta(days=settings.token_ttl_days)
    return jwt.encode({"sub": settings.app_username, "exp": exp}, settings.session_secret, algorithm="HS256")


def token_valid(token: str | None) -> bool:
    if not token:
        return False
    try:
        jwt.decode(token, settings.session_secret, algorithms=["HS256"])
        return True
    except jwt.PyJWTError:
        return False


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.token_ttl_days * 86400,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


def require_auth(request: Request) -> None:
    """Dépendance FastAPI : protège toutes les routes /api métier."""
    if not token_valid(request.cookies.get(COOKIE)):
        raise HTTPException(status_code=401, detail="non authentifié")
