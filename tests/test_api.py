from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "connected"


def test_list_farms():
    response = client.get("/farms")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_missing_farm_analytics():
    response = client.get("/analytics/farm/999999")
    assert response.status_code == 404


def test_missing_cow_alerts():
    response = client.get("/alerts/cow/999999")
    assert response.status_code == 404
