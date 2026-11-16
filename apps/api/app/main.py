"""Glu API: a stateless proxy.

- hides the vision model API key,
- proxies and caches Open Food Facts product sheets.

No user data is persisted or logged: images are processed in memory only,
request bodies and paths are never logged, and the only cache holds public
Open Food Facts product data keyed by barcode.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import ratelimit
from .config import Settings, load_settings
from .routes import health, products, vision
from .services.cache import create_cache


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.http = httpx.AsyncClient(follow_redirects=True)
        app.state.cache = create_cache(settings.redis_url)
        try:
            yield
        finally:
            await app.state.http.aclose()
            await app.state.cache.close()

    app = FastAPI(title="Glu API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings

    # Simple per-IP rate limit on product and vision routes (not /api/health).
    ratelimit.configure(settings.rate_limit)
    app.state.limiter = ratelimit.limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(products.router, prefix="/api")
    app.include_router(vision.router, prefix="/api")
    return app


app = create_app()
