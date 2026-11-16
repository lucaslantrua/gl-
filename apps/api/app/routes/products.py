from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Request

from ..ratelimit import current_limit, limiter
from ..schemas import Product
from ..services import off_client

router = APIRouter(tags=["products"])


@router.get("/products/{barcode}", response_model=Product)
@limiter.limit(current_limit)
async def get_product(
    request: Request,
    barcode: Annotated[str, Path(pattern=r"^\d{6,14}$", description="EAN / UPC barcode")],
) -> Product:
    state = request.app.state
    try:
        product = await off_client.get_product(
            barcode,
            http=state.http,
            cache=state.cache,
            user_agent=state.settings.off_user_agent,
        )
    except off_client.OffUnavailable:
        raise HTTPException(status_code=502, detail="Open Food Facts est injoignable pour le moment.")
    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Produit inconnu ou sans glucides renseignés. Essaie la photo d'étiquette.",
        )
    return product
