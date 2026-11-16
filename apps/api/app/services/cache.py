"""Cache for public catalogue data (Open Food Facts products) only.

Never used for user data: keys are barcodes, values are public product sheets.
Redis when REDIS_URL is set, otherwise an in-process LRU with TTL.
"""

from __future__ import annotations

import json
import logging
import time
from collections import OrderedDict
from typing import Any, Callable, Optional, Protocol

logger = logging.getLogger("glu.cache")


class Cache(Protocol):
    async def get(self, key: str) -> Optional[Any]: ...
    async def set(self, key: str, value: Any, ttl_s: int) -> None: ...
    async def close(self) -> None: ...


class MemoryLRUCache:
    def __init__(self, max_items: int = 5000, clock: Callable[[], float] = time.monotonic) -> None:
        self._max = max_items
        self._clock = clock
        self._data: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    async def get(self, key: str) -> Optional[Any]:
        hit = self._data.get(key)
        if hit is None:
            return None
        expires_at, value = hit
        if expires_at <= self._clock():
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    async def set(self, key: str, value: Any, ttl_s: int) -> None:
        self._data[key] = (self._clock() + ttl_s, value)
        self._data.move_to_end(key)
        while len(self._data) > self._max:
            self._data.popitem(last=False)

    async def close(self) -> None:
        self._data.clear()

    def __len__(self) -> int:
        return len(self._data)


class RedisCache:
    """Redis-backed cache. Any Redis failure degrades to a cache miss."""

    def __init__(self, url: str) -> None:
        import redis.asyncio as redis  # local import: optional at runtime

        self._redis = redis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> Optional[Any]:
        try:
            raw = await self._redis.get(key)
        except Exception:
            logger.warning("redis get failed, treating as miss")
            return None
        return json.loads(raw) if raw is not None else None

    async def set(self, key: str, value: Any, ttl_s: int) -> None:
        try:
            await self._redis.set(key, json.dumps(value), ex=ttl_s)
        except Exception:
            logger.warning("redis set failed, value not cached")

    async def close(self) -> None:
        try:
            await self._redis.aclose()
        except Exception:
            pass


def create_cache(redis_url: str = "") -> Cache:
    if redis_url:
        return RedisCache(redis_url)
    return MemoryLRUCache()
