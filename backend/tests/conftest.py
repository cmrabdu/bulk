"""Fixtures de test : DB SQLite temporaire + client authentifié.

L'environnement est fixé AVANT tout import de l'app (pydantic-settings lit à l'import).
"""
import os
import tempfile

os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ.setdefault("SESSION_SECRET", "test-secret")
os.environ.setdefault("APP_USERNAME", "tester")
os.environ.setdefault("APP_PASSWORD", "testpass")
os.environ.setdefault("COOKIE_SECURE", "false")

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_client(client):
    r = client.post("/api/auth/login", json={"username": "tester", "password": "testpass"})
    assert r.status_code == 200
    return client
