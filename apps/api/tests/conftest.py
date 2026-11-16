import json
from pathlib import Path

import pytest
import respx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"
VISION_URL = "https://vision.test/v1/chat/completions"
OFF_BASE = "https://world.openfoodfacts.org/api/v2/product"


def make_settings(**overrides) -> Settings:
    base = dict(
        vision_api_base_url="https://vision.test/v1",
        vision_api_key="test-key",
        vision_model="test-model",
        off_user_agent="GluTests/0.1 (tests@example.com)",
        rate_limit="1000/minute",
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
def client():
    with TestClient(create_app(make_settings())) as c:
        yield c


@pytest.fixture
def mock_http():
    with respx.mock(assert_all_called=False) as router:
        yield router


@pytest.fixture
def plate_jpeg() -> bytes:
    return (FIXTURES / "plates" / "plate_01_pasta_tomato.jpg").read_bytes()


@pytest.fixture
def label_jpeg() -> bytes:
    return (FIXTURES / "labels" / "label_01_fr_cereales.jpg").read_bytes()


def completion(content) -> dict:
    """Shape of an OpenAI-compatible chat completion."""
    if not isinstance(content, str):
        content = json.dumps(content)
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}
