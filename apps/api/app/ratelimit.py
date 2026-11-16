"""Simple per-IP rate limiting (slowapi).

Routes opt in with `@limiter.limit(current_limit)`; /api/health is left unlimited.
The limit string comes from RATE_LIMIT and is resolved at request time.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

_state = {"limit": "30/minute"}

limiter = Limiter(key_func=get_remote_address)


def current_limit() -> str:
    return _state["limit"]


def configure(limit: str) -> None:
    _state["limit"] = limit
    limiter.reset()
