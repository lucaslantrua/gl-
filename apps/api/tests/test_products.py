import httpx

from app.config import OFF_CACHE_TTL_S

from .conftest import OFF_BASE

NUTELLA = {
    "code": "3017620422003",
    "status": 1,
    "product": {
        "product_name": "Nutella",
        "brands": "Ferrero, Nutella",
        "serving_quantity": "15",
        "product_quantity": "400",
        "nutriscore_grade": "e",
        "image_front_small_url": "https://images.openfoodfacts.org/nutella.jpg",
        "categories_tags": ["en:spreads", "en:sweet-spreads"],
        "nutriments": {
            "carbohydrates_100g": 57.5,
            "sugars_100g": 56.3,
            "fiber_100g": 0,
            "proteins_100g": 6.3,
            "fat_100g": 30.9,
        },
    },
}

COLA = {
    "status": 1,
    "product": {
        "product_name": "Cola",
        "brands": "Some Brand",
        "categories_tags": ["en:beverages", "en:sodas"],
        "nutriments": {"carbohydrates_100g": "10.6", "sugars_100g": "10.6"},
    },
}


def test_ttl_is_seven_days():
    assert OFF_CACHE_TTL_S == 7 * 24 * 3600


def test_product_normalisation(client, mock_http):
    route = mock_http.get(f"{OFF_BASE}/3017620422003.json").respond(json=NUTELLA)
    r = client.get("/api/products/3017620422003")
    assert r.status_code == 200
    assert r.json() == {
        "barcode": "3017620422003",
        "name": "Nutella",
        "brand": "Ferrero",
        "unit": "g",
        "per100": {"carbs": 57.5, "sugars": 56.3, "fiber": 0, "protein": 6.3, "fat": 30.9},
        "servingQuantity": 15,
        "packageQuantity": 400,
        "nutriscore": "e",
        "imageUrl": "https://images.openfoodfacts.org/nutella.jpg",
        "isBeverage": False,
        "categories": ["en:spreads", "en:sweet-spreads"],
    }
    request = route.calls.last.request
    assert request.headers["user-agent"] == "GluTests/0.1 (tests@example.com)"
    fields = request.url.params["fields"]
    assert "nutriments" in fields and "categories_tags" in fields and "product_quantity" in fields


def test_beverage_is_ml(client, mock_http):
    mock_http.get(f"{OFF_BASE}/5449000000996.json").respond(json=COLA)
    body = client.get("/api/products/5449000000996").json()
    assert body["unit"] == "ml"
    assert body["isBeverage"] is True
    assert body["per100"] == {"carbs": 10.6, "sugars": 10.6, "fiber": None, "protein": None, "fat": None}
    assert body["servingQuantity"] is None
    assert body["packageQuantity"] is None
    assert body["nutriscore"] is None


def test_unknown_product_404(client, mock_http):
    mock_http.get(f"{OFF_BASE}/0000000000000.json").respond(
        404, json={"status": 0, "status_verbose": "product not found"}
    )
    assert client.get("/api/products/0000000000000").status_code == 404


def test_unknown_product_status_0_with_http_200(client, mock_http):
    mock_http.get(f"{OFF_BASE}/0000000000001.json").respond(json={"status": 0})
    assert client.get("/api/products/0000000000001").status_code == 404


def test_missing_carbohydrates_404(client, mock_http):
    payload = {"status": 1, "product": {"product_name": "Mystère", "nutriments": {"sugars_100g": 3}}}
    mock_http.get(f"{OFF_BASE}/1234567890123.json").respond(json=payload)
    r = client.get("/api/products/1234567890123")
    assert r.status_code == 404
    assert "étiquette" in r.json()["detail"]


def test_cache_hit_calls_off_once(client, mock_http):
    route = mock_http.get(f"{OFF_BASE}/3017620422003.json").respond(json=NUTELLA)
    first = client.get("/api/products/3017620422003")
    second = client.get("/api/products/3017620422003")
    assert first.json() == second.json()
    assert route.call_count == 1


def test_not_found_is_cached_too(client, mock_http):
    route = mock_http.get(f"{OFF_BASE}/0000000000000.json").respond(404, json={"status": 0})
    assert client.get("/api/products/0000000000000").status_code == 404
    assert client.get("/api/products/0000000000000").status_code == 404
    assert route.call_count == 1


def test_off_error_is_502_and_not_cached(client, mock_http):
    route = mock_http.get(f"{OFF_BASE}/3017620422003.json")
    route.side_effect = [httpx.Response(503), httpx.Response(200, json=NUTELLA)]
    assert client.get("/api/products/3017620422003").status_code == 502
    assert client.get("/api/products/3017620422003").status_code == 200


def test_off_timeout_is_502(client, mock_http):
    mock_http.get(f"{OFF_BASE}/3017620422003.json").mock(side_effect=httpx.ConnectTimeout("boom"))
    assert client.get("/api/products/3017620422003").status_code == 502


def test_invalid_barcode_rejected_without_calling_off(client, mock_http):
    route = mock_http.get(url__startswith=OFF_BASE)
    assert client.get("/api/products/abc").status_code == 422
    assert client.get("/api/products/12").status_code == 422
    assert route.call_count == 0


def test_unparseable_package_quantity_is_null(client, mock_http):
    payload = {
        "status": 1,
        "product": {"product_name": "Biscuits", "product_quantity": "2 x 150 g", "nutriments": {"carbohydrates_100g": 60}},
    }
    mock_http.get(f"{OFF_BASE}/1234567890128.json").respond(json=payload)
    assert client.get("/api/products/1234567890128").json()["packageQuantity"] is None
