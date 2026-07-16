"""Tests bout-en-bout du cœur : auth, objectifs, journal, progression."""
from app.models import User
from app.nutrition import bmr, progress_state, target_kcal_final, target_protein


def test_bmr_and_targets():
    u = User(weight_kg=80, height_cm=178, age=25, sex="m",
             activity_factor=1.5, protein_coef_g_per_kg=2.0, surplus_pct=10.0)
    # Mifflin homme : 10*80 + 6.25*178 - 5*25 + 5 = 1792.5
    assert round(bmr(u), 1) == 1792.5
    assert target_protein(u) == 160                 # 80 * 2.0
    assert target_kcal_final(u) == round(round(1792.5 * 1.5) * 1.1)


def test_progress_state():
    assert progress_state(0, 180) == "under"
    assert progress_state(100, 180) == "on_track"
    assert progress_state(180, 180) == "reached"
    assert progress_state(200, 180, alert_over=True) == "over"      # >110% kcal
    assert progress_state(200, 180, alert_over=False) == "reached"  # protéines : pas d'alerte


def test_requires_auth(client):
    assert client.get("/api/summary/today").status_code == 401


def test_entry_flow_and_summary(auth_client):
    # per_100g : poulet 165 kcal / 31 g prot pour 100 g, on logge 200 g
    r = auth_client.post("/api/entries", json={
        "name": "Poulet", "quantity": 200, "unit": "g",
        "per_100g": {"kcal": 165, "protein_g": 31},
    })
    assert r.status_code == 200
    e = r.json()
    assert e["kcal"] == 330 and e["protein_g"] == 62.0

    # saisie manuelle : 1 shake = 250 kcal / 25 g, quantité 2
    r = auth_client.post("/api/entries", json={
        "name": "Shake", "quantity": 2, "unit": "portion",
        "manual": {"kcal": 250, "protein_g": 25},
    })
    assert r.status_code == 200
    assert r.json()["kcal"] == 500 and r.json()["protein_g"] == 50.0

    s = auth_client.get("/api/summary/today").json()
    assert s["kcal"]["total"] == 830
    assert s["protein"]["total"] == 112.0
    assert s["entries_count"] == 2

    entries = auth_client.get("/api/entries").json()["entries"]
    assert len(entries) == 2

    # patch quantité : 200 g -> 100 g doit diviser les macros par 2
    eid = entries[0]["id"]
    r = auth_client.patch(f"/api/entries/{eid}", json={"quantity": 100})
    assert r.json()["kcal"] == 165 and r.json()["protein_g"] == 31.0

    # delete
    assert auth_client.delete(f"/api/entries/{eid}").status_code == 204
    assert len(auth_client.get("/api/entries").json()["entries"]) == 1


def test_settings_update(auth_client):
    r = auth_client.put("/api/settings", json={"weight_kg": 90, "protein_coef_g_per_kg": 2.0})
    assert r.status_code == 200
    assert r.json()["target_protein_g"] == 180  # 90 * 2.0
