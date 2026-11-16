"""Runtime configuration, read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = ("image/webp", "image/jpeg")
OFF_CACHE_TTL_S = 7 * 24 * 3600
OFF_NEGATIVE_CACHE_TTL_S = 3600


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    vision_api_base_url: str = "https://api.scaleway.ai/v1"
    vision_api_key: str = ""
    vision_model: str = "gemma-4-26b-a4b-it"
    vision_json_mode: bool = True
    vision_reasoning_effort: str = ""
    off_user_agent: str = "Glu/0.1 (contact@example.com)"
    redis_url: str = ""
    allowed_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173"])
    rate_limit: str = "30/minute"


def load_settings() -> Settings:
    env = os.environ
    origins = [o.strip() for o in env.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    return Settings(
        vision_api_base_url=(env.get("VISION_API_BASE_URL") or "https://api.scaleway.ai/v1").rstrip("/"),
        vision_api_key=env.get("VISION_API_KEY", ""),
        vision_model=env.get("VISION_MODEL") or "gemma-4-26b-a4b-it",
        vision_json_mode=_bool(env.get("VISION_JSON_MODE"), True),
        vision_reasoning_effort=env.get("VISION_REASONING_EFFORT", "").strip().lower(),
        off_user_agent=env.get("OFF_USER_AGENT") or "Glu/0.1 (contact@example.com)",
        redis_url=env.get("REDIS_URL", "").strip(),
        allowed_origins=origins,
        rate_limit=env.get("RATE_LIMIT") or "30/minute",
    )
