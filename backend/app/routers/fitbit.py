"""Fitbit — stub V1. Les endpoints existent pour figer le contrat côté front ;
l'OAuth réel sera branché quand le site tournera en HTTPS (redirect_uri valide).
"""
from fastapi import APIRouter, Depends

from ..auth import require_auth

router = APIRouter(prefix="/api/fitbit", tags=["fitbit"], dependencies=[Depends(require_auth)])


@router.get("/status")
def status():
    # available=False -> le front affiche le bloc Fitbit en "bientôt".
    return {"connected": False, "available": False}


@router.get("/sync")
def sync():
    return {"ok": False, "reason": "not_configured"}
