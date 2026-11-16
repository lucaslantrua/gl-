"""Open Food Facts client: fetch + normalise + cache.

Data © Open Food Facts contributors, ODbL licence.
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

from ..config import OFF_CACHE_TTL_S, OFF_NEGATIVE_CACHE_TTL_S
from ..schemas import Per100, Product
from .cache import Cache

OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
OFF_FIELDS = (
    "product_name,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments,"
    "nutriscore_grade,image_front_small_url,categories_tags"
)
_NOT_FOUND = {"notFound": True}


class OffUnavailable(Exception):
    """Open Food Facts could not be reached or answered with an error."""


def _num(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        n = float(str(value).replace(",", "."))
    except ValueError:
        return None
    if n != n or n < 0:  # NaN or negative
        return None
    return n


def normalise(barcode: str, product: dict[str, Any]) -> Optional[Product]:
    """Map an OFF product to Glu's shape. None when carbs per 100 are missing."""
    nutriments = product.get("nutriments") or {}
    carbs = _num(nutriments.get("carbohydrates_100g"))
    if carbs is None:
        return None

    categories = [c for c in (product.get("categories_tags") or []) if isinstance(c, str)]
    is_beverage = "en:beverages" in categories

    brands = product.get("brands") or ""
    brand = brands.split(",")[0].strip() or None

    grade = (product.get("nutriscore_grade") or "").strip().lower()
    serving = _num(product.get("serving_quantity"))
    package = _num(product.get("product_quantity"))

    return Product(
        barcode=barcode,
        name=(product.get("product_name") or "").strip() or "Produit sans nom",
        brand=brand,
        unit="ml" if is_beverage else "g",
        per100=Per100(
            carbs=carbs,
            sugars=_num(nutriments.get("sugars_100g")),
            fiber=_num(nutriments.get("fiber_100g")),
            protein=_num(nutriments.get("proteins_100g")),
            fat=_num(nutriments.get("fat_100g")),
        ),
        servingQuantity=serving if serving else None,
        packageQuantity=package if package else None,
        nutriscore=grade if grade in {"a", "b", "c", "d", "e"} else None,
        imageUrl=product.get("image_front_small_url") or None,
        isBeverage=is_beverage,
        categories=categories,
    )


async def get_product(
    barcode: str,
    *,
    http: httpx.AsyncClient,
    cache: Cache,
    user_agent: str,
) -> Optional[Product]:
    """Return the normalised product, or None if unknown / unusable."""
    key = f"off:v2:{barcode}"
    cached = await cache.get(key)
    if cached is not None:
        return None if cached.get("notFound") else Product.model_validate(cached)

    try:
        resp = await http.get(
            OFF_URL.format(barcode=barcode),
            params={"fields": OFF_FIELDS},
            headers={"User-Agent": user_agent, "Accept": "application/json"},
            timeout=6.0,
        )
    except httpx.HTTPError as exc:
        raise OffUnavailable(type(exc).__name__) from exc

    if resp.status_code == 404:
        await cache.set(key, _NOT_FOUND, OFF_NEGATIVE_CACHE_TTL_S)
        return None
    if resp.status_code >= 400:
        raise OffUnavailable(f"HTTP {resp.status_code}")

    try:
        body = resp.json()
    except ValueError as exc:
        raise OffUnavailable("invalid JSON") from exc

    raw = body.get("product") if isinstance(body, dict) else None
    product = normalise(barcode, raw) if isinstance(raw, dict) and body.get("status", 1) != 0 else None
    if product is None:
        await cache.set(key, _NOT_FOUND, OFF_NEGATIVE_CACHE_TTL_S)
        return None

    await cache.set(key, product.model_dump(), OFF_CACHE_TTL_S)
    return product
