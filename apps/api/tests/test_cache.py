import asyncio

from app.services.cache import MemoryLRUCache, create_cache


def run(coro):
    return asyncio.run(coro)


def test_ttl_expiry():
    now = [0.0]
    cache = MemoryLRUCache(clock=lambda: now[0])
    run(cache.set("k", {"a": 1}, ttl_s=10))
    assert run(cache.get("k")) == {"a": 1}
    now[0] = 10.1
    assert run(cache.get("k")) is None


def test_lru_eviction():
    cache = MemoryLRUCache(max_items=2)
    run(cache.set("a", 1, 60))
    run(cache.set("b", 2, 60))
    run(cache.get("a"))  # a becomes most recent
    run(cache.set("c", 3, 60))
    assert run(cache.get("b")) is None
    assert run(cache.get("a")) == 1
    assert run(cache.get("c")) == 3


def test_memory_cache_is_default_without_redis():
    assert isinstance(create_cache(""), MemoryLRUCache)
