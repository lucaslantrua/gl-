import base64
import json

import httpx

from .conftest import VISION_URL, completion

PLATE_OK = {
    "items": [
        {
            "name": "Pâtes cuites",
            "estimatedQuantityG": 220,
            "carbsG": 66,
            "carbsMinG": 55,
            "carbsMaxG": 80,
            "fiberG": 4,
            "proteinG": 12,
            "glycemicIndex": 50,
            "giCategory": "medium",
            "box": {"x": 0.2, "y": 0.2, "w": 0.5, "h": 0.5},
        },
        {
            "name": "Jus d'orange",
            "estimatedQuantityG": 200,
            "unit": "ml",
            "carbsG": 18,
            "carbsMinG": 16,
            "carbsMaxG": 22,
            "sugarsG": 17,
        },
    ],
    "notes": "Sauce tomate probablement sucrée, impact faible.",
    "overallConfidence": "medium",
}

LABEL_OK = {
    "per100": {"carbs": 68.0, "sugars": 21.5, "fiber": None, "protein": 8.1, "fat": None},
    "servingQuantity": 30,
    "unit": "g",
    "name": "Céréales",
}


def upload(client, path, data, content_type="image/jpeg", filename="photo.jpg"):
    return client.post(path, files={"image": (filename, data, content_type)})


# ---------- plate ----------


def test_plate_ok(client, mock_http, plate_jpeg):
    route = mock_http.post(VISION_URL).respond(json=completion(PLATE_OK))
    r = upload(client, "/api/vision/plate", plate_jpeg)
    assert r.status_code == 200
    body = r.json()
    assert [i["name"] for i in body["items"]] == ["Pâtes cuites", "Jus d'orange"]
    pasta, juice = body["items"]
    assert pasta["unit"] == "g" and juice["unit"] == "ml"
    assert pasta["box"] == {"x": 0.2, "y": 0.2, "w": 0.5, "h": 0.5}
    assert juice["box"] is None and juice["glycemicIndex"] is None and juice["giCategory"] is None
    assert body["overallConfidence"] == "medium"

    request = route.calls.last.request
    assert request.headers["authorization"] == "Bearer test-key"
    sent = json.loads(request.content)
    assert sent["model"] == "test-model"
    assert sent["response_format"] == {"type": "json_object"}
    assert sent["messages"][0]["role"] == "system"
    image_url = sent["messages"][1]["content"][1]["image_url"]["url"]
    assert image_url == "data:image/jpeg;base64," + base64.b64encode(plate_jpeg).decode()


def test_plate_json_in_code_fence(client, mock_http, plate_jpeg):
    fenced = "```json\n" + json.dumps(PLATE_OK) + "\n```"
    route = mock_http.post(VISION_URL).respond(json=completion(fenced))
    r = upload(client, "/api/vision/plate", plate_jpeg)
    assert r.status_code == 200
    assert route.call_count == 1


def test_plate_invalid_then_retry_success(client, mock_http, plate_jpeg):
    route = mock_http.post(VISION_URL)
    route.side_effect = [
        httpx.Response(200, json=completion("Voici mon analyse : des pâtes !")),
        httpx.Response(200, json=completion(PLATE_OK)),
    ]
    r = upload(client, "/api/vision/plate", plate_jpeg)
    assert r.status_code == 200
    assert route.call_count == 2
    retry = json.loads(route.calls.last.request.content)["messages"]
    assert [m["role"] for m in retry] == ["system", "user", "assistant", "user"]
    assert retry[2]["content"] == "Voici mon analyse : des pâtes !"
    assert "JSON" in retry[3]["content"]


def test_plate_schema_invalid_then_retry_success(client, mock_http, plate_jpeg):
    bad = {"items": [{"name": "Pâtes", "carbsG": "beaucoup"}]}
    route = mock_http.post(VISION_URL)
    route.side_effect = [
        httpx.Response(200, json=completion(bad)),
        httpx.Response(200, json=completion(PLATE_OK)),
    ]
    assert upload(client, "/api/vision/plate", plate_jpeg).status_code == 200
    assert route.call_count == 2


def test_plate_invalid_twice_is_422(client, mock_http, plate_jpeg):
    route = mock_http.post(VISION_URL).respond(json=completion("not json at all"))
    r = upload(client, "/api/vision/plate", plate_jpeg)
    assert r.status_code == 422
    assert route.call_count == 2  # exactly one retry


def test_plate_no_food(client, mock_http, plate_jpeg):
    empty = {"items": [], "notes": "Aucun aliment visible sur la photo.", "overallConfidence": "high"}
    mock_http.post(VISION_URL).respond(json=completion(empty))
    r = upload(client, "/api/vision/plate", plate_jpeg)
    assert r.status_code == 200
    assert r.json()["items"] == []
    assert r.json()["notes"] == "Aucun aliment visible sur la photo."


def test_plate_range_and_gi_category_are_made_coherent(client, mock_http, plate_jpeg):
    odd = {
        "items": [
            {
                "name": "Riz blanc",
                "estimatedQuantityG": 150,
                "carbsG": 42,
                "carbsMinG": 45,
                "carbsMaxG": 40,
                "glycemicIndex": 73,
                "giCategory": "low",
            }
        ],
        "overallConfidence": "low",
    }
    mock_http.post(VISION_URL).respond(json=completion(odd))
    item = upload(client, "/api/vision/plate", plate_jpeg).json()["items"][0]
    assert item["carbsMinG"] <= item["carbsG"] <= item["carbsMaxG"]
    assert item["giCategory"] == "high"


def test_vision_upstream_error_is_502(client, mock_http, plate_jpeg):
    mock_http.post(VISION_URL).respond(500, json={"error": "boom"})
    assert upload(client, "/api/vision/plate", plate_jpeg).status_code == 502


# ---------- upload validation ----------


def test_image_too_large_is_413(client, mock_http):
    route = mock_http.post(VISION_URL).respond(json=completion(PLATE_OK))
    big = b"\xff\xd8\xff" + b"0" * (2 * 1024 * 1024)
    assert upload(client, "/api/vision/plate", big).status_code == 413
    assert route.call_count == 0


def test_wrong_content_type_is_415(client, mock_http, plate_jpeg):
    route = mock_http.post(VISION_URL).respond(json=completion(PLATE_OK))
    assert upload(client, "/api/vision/plate", plate_jpeg, "image/png", "photo.png").status_code == 415
    assert upload(client, "/api/vision/label", b"%PDF-1.4", "application/pdf", "a.pdf").status_code == 415
    assert route.call_count == 0


def test_declared_jpeg_but_not_an_image_is_415(client, mock_http):
    route = mock_http.post(VISION_URL).respond(json=completion(PLATE_OK))
    assert upload(client, "/api/vision/plate", b"hello, not an image").status_code == 415
    assert route.call_count == 0


def test_webp_accepted(client, mock_http):
    mock_http.post(VISION_URL).respond(json=completion(PLATE_OK))
    webp = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 32
    r = upload(client, "/api/vision/plate", webp, "image/webp", "photo.webp")
    assert r.status_code == 200


def test_missing_image_field_is_422(client):
    assert client.post("/api/vision/plate").status_code == 422


# ---------- label ----------


def test_label_ok_with_nulls(client, mock_http, label_jpeg):
    mock_http.post(VISION_URL).respond(json=completion(LABEL_OK))
    r = upload(client, "/api/vision/label", label_jpeg)
    assert r.status_code == 200
    assert r.json() == {
        "per100": {"carbs": 68.0, "sugars": 21.5, "fiber": None, "protein": 8.1, "fat": None},
        "servingQuantity": 30,
        "unit": "g",
        "name": "Céréales",
        "confidence": "manufacturer",
    }


def test_label_all_optional_null(client, mock_http, label_jpeg):
    minimal = {
        "per100": {"carbs": 10.6, "sugars": None, "fiber": None, "protein": None, "fat": None},
        "servingQuantity": None,
        "unit": "ml",
        "name": None,
    }
    mock_http.post(VISION_URL).respond(json=completion(minimal))
    body = upload(client, "/api/vision/label", label_jpeg).json()
    assert body["unit"] == "ml"
    assert body["servingQuantity"] is None and body["name"] is None
    assert body["per100"]["sugars"] is None


def test_label_unreadable_carbs_is_422(client, mock_http, label_jpeg):
    unreadable = {
        "per100": {"carbs": None, "sugars": 4, "fiber": None, "protein": None, "fat": None},
        "servingQuantity": None,
        "unit": "g",
        "name": None,
    }
    route = mock_http.post(VISION_URL).respond(json=completion(unreadable))
    r = upload(client, "/api/vision/label", label_jpeg)
    assert r.status_code == 422
    assert "illisibles" in r.json()["detail"]
    assert route.call_count == 1  # valid JSON: no retry, we never ask the model to guess


def test_label_invalid_json_retry(client, mock_http, label_jpeg):
    route = mock_http.post(VISION_URL)
    route.side_effect = [
        httpx.Response(200, json=completion("{oops")),
        httpx.Response(200, json=completion(LABEL_OK)),
    ]
    assert upload(client, "/api/vision/label", label_jpeg).status_code == 200
    assert route.call_count == 2
