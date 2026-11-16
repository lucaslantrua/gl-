from fastapi import APIRouter, HTTPException, Request, UploadFile

from ..config import ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES
from ..ratelimit import current_limit, limiter
from ..schemas import LabelExtraction, LabelResponse, PlateResponse
from ..services import vision_client

router = APIRouter(prefix="/vision", tags=["vision"])


def _sniff(data: bytes) -> str | None:
    """Detect the real image type from magic bytes."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _read_image(image: UploadFile) -> tuple[bytes, str]:
    declared = (image.content_type or "").split(";")[0].strip().lower()
    if declared not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Format d'image non pris en charge (WebP ou JPEG).")
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image trop lourde (2 Mo maximum).")
    actual = _sniff(data)
    if actual is None:
        raise HTTPException(status_code=415, detail="Format d'image non pris en charge (WebP ou JPEG).")
    return data, actual


async def _analyse(request: Request, image: UploadFile, prompt_name: str, schema):
    data, content_type = await _read_image(image)
    state = request.app.state
    try:
        return await vision_client.analyse_image(
            http=state.http,
            settings=state.settings,
            prompt_name=prompt_name,
            image=data,
            content_type=content_type,
            schema=schema,
        )
    except vision_client.VisionInvalidResponse:
        raise HTTPException(status_code=422, detail="L'analyse n'a pas donné de résultat exploitable. Réessaie.")
    except vision_client.VisionUnavailable:
        raise HTTPException(status_code=502, detail="Le service d'analyse est injoignable pour le moment.")


@router.post("/plate", response_model=PlateResponse)
@limiter.limit(current_limit)
async def analyse_plate(request: Request, image: UploadFile) -> PlateResponse:
    return await _analyse(request, image, "plate", PlateResponse)


@router.post("/label", response_model=LabelResponse)
@limiter.limit(current_limit)
async def analyse_label(request: Request, image: UploadFile) -> LabelResponse:
    extraction: LabelExtraction = await _analyse(request, image, "label", LabelExtraction)
    if extraction.per100.carbs is None:
        raise HTTPException(
            status_code=422,
            detail="Glucides illisibles sur l'étiquette. Reprends la photo ou saisis la valeur à la main.",
        )
    return LabelResponse(**extraction.model_dump())
