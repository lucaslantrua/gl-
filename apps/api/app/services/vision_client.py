"""Client for an OpenAI-compatible vision model (/chat/completions).

The image is forwarded in memory and never written to disk or logged.
"""

from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from ..config import Settings

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
T = TypeVar("T", bound=BaseModel)

_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)

CORRECTION = (
    "Your previous answer was not valid for the required schema ({error}). "
    "Answer again with ONLY one JSON object that follows the schema exactly: "
    "no markdown, no code fences, no commentary."
)


class VisionInvalidResponse(Exception):
    """The model did not return schema-valid JSON, even after one retry."""


class VisionUnavailable(Exception):
    """The vision API could not be reached or answered with an error."""


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def extract_json(text: str) -> Any:
    """Parse model output, tolerating ```json fences and surrounding prose."""
    text = text.strip()
    fenced = _FENCE.match(text)
    if fenced:
        text = fenced.group(1)
    try:
        return json.loads(text)
    except ValueError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def _short_error(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        parts = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()[:5]]
        return "; ".join(parts)
    return "not parseable as JSON"


async def _complete(http: httpx.AsyncClient, settings: Settings, messages: list[dict[str, Any]]) -> str:
    payload: dict[str, Any] = {
        "model": settings.vision_model,
        "messages": messages,
        "temperature": 0.2,
        # Headroom for models that reason first: their thinking tokens count against this cap.
        "max_tokens": 4096,
    }
    if settings.vision_json_mode:
        payload["response_format"] = {"type": "json_object"}
    if settings.vision_reasoning_effort:
        # e.g. "none" skips the model's reasoning phase: much faster, at some cost in care.
        payload["reasoning_effort"] = settings.vision_reasoning_effort
    headers = {"Content-Type": "application/json"}
    if settings.vision_api_key:
        headers["Authorization"] = f"Bearer {settings.vision_api_key}"

    try:
        resp = await http.post(
            f"{settings.vision_api_base_url}/chat/completions",
            json=payload,
            headers=headers,
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        raise VisionUnavailable(type(exc).__name__) from exc
    if resp.status_code >= 400:
        raise VisionUnavailable(f"HTTP {resp.status_code}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise VisionUnavailable("unexpected response shape") from exc
    if isinstance(content, list):  # some servers return content parts
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return content or ""


async def analyse_image(
    *,
    http: httpx.AsyncClient,
    settings: Settings,
    prompt_name: str,
    image: bytes,
    content_type: str,
    schema: type[T],
) -> T:
    """Send the image with a prompt, validate the JSON answer, retry once."""
    data_url = f"data:{content_type};base64,{base64.b64encode(image).decode('ascii')}"
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": load_prompt(prompt_name)},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Analyse this image and answer with the JSON object only."},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        },
    ]

    last_error = ""
    for attempt in range(2):
        raw = await _complete(http, settings, messages)
        try:
            return schema.model_validate(extract_json(raw))
        except (ValueError, ValidationError) as exc:
            last_error = _short_error(exc)
            if attempt == 0:
                messages = messages + [
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": CORRECTION.format(error=last_error)},
                ]
    raise VisionInvalidResponse(last_error)
