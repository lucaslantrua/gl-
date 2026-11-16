from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app

from .conftest import FIXTURES, OFF_BASE, make_settings


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_cors_allowed_origin():
    settings = make_settings(allowed_origins=["https://glu.example"])
    with TestClient(create_app(settings)) as c:
        ok = c.get("/api/health", headers={"Origin": "https://glu.example"})
        other = c.get("/api/health", headers={"Origin": "https://evil.example"})
    assert ok.headers["access-control-allow-origin"] == "https://glu.example"
    assert "access-control-allow-origin" not in other.headers


def test_rate_limit_per_ip(mock_http):
    mock_http.get(f"{OFF_BASE}/0000000000000.json").respond(404, json={"status": 0})
    with TestClient(create_app(make_settings(rate_limit="2/minute"))) as c:
        codes = [c.get("/api/products/0000000000000").status_code for _ in range(3)]
        assert codes == [404, 404, 429]
        # health stays reachable for probes
        assert c.get("/api/health").status_code == 200


def test_fixtures_present():
    assert len(list((FIXTURES / "plates").glob("*.jpg"))) == 5
    assert len(list((FIXTURES / "labels").glob("*.jpg"))) == 3


def test_no_persistence_or_body_logging_in_source():
    """Guard for the 'no user data written server-side' acceptance criterion."""
    forbidden = ("open(", ".write(", "write_bytes", "write_text", "sqlite", "print(")
    for path in (Path(__file__).parent.parent / "app").rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in source, f"{token!r} found in {path.name}"


def test_rate_limit_on_vision_routes(mock_http):
    with TestClient(create_app(make_settings(rate_limit="1/minute"))) as c:
        files = {"image": ("a.png", b"x", "image/png")}
        assert c.post("/api/vision/plate", files=files).status_code == 415
        assert c.post("/api/vision/plate", files=files).status_code == 429
