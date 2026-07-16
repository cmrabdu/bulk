"""Endpoints d'authentification (login stylisé côté front)."""
from fastapi import APIRouter, HTTPException, Request, Response

from ..auth import (
    COOKIE,
    clear_session_cookie,
    make_token,
    set_session_cookie,
    token_valid,
    verify_credentials,
)
from ..schemas import LoginIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginIn, response: Response):
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="identifiants invalides")
    set_session_cookie(response, make_token())
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    return {"authenticated": token_valid(request.cookies.get(COOKIE))}
