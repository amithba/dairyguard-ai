
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def get_auth_headers():
    username = f"ci_test_{uuid4().hex[:10]}"

    register_response = client.post(
        "/auth/register",
        json={
            "username": username,
            "password": "TestPassword123!"
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={
            "username": username,
            "password": "TestPassword123!"
        },
    )
    assert login_response.status_code == 200

    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "connected"


def test_list_farms():
    headers = get_auth_headers()

    response = client.get("/farms", headers=headers)

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_missing_farm_analytics():
    headers = get_auth_headers()

    response = client.get(
        "/analytics/farm/999999",
        headers=headers,
    )

    assert response.status_code == 404


def test_missing_cow_alerts():
    headers = get_auth_headers()

    response = client.get(
        "/alerts/cow/999999",
        headers=headers,
    )

    assert response.status_code == 404
