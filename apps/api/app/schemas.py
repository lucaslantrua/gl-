"""Pydantic schemas. Everything here is transient: nothing is persisted server-side."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

GiCategory = Literal["low", "medium", "high"]
Unit = Literal["g", "ml"]


def gi_category(gi: float) -> GiCategory:
    """Low < 55, medium 55-69, high >= 70."""
    if gi < 55:
        return "low"
    if gi < 70:
        return "medium"
    return "high"


# ---------- Products (Open Food Facts) ----------


class Per100(BaseModel):
    carbs: float
    sugars: Optional[float] = None
    fiber: Optional[float] = None
    protein: Optional[float] = None
    fat: Optional[float] = None


class Product(BaseModel):
    barcode: str
    name: str
    brand: Optional[str] = None
    unit: Unit = "g"
    per100: Per100
    servingQuantity: Optional[float] = None
    # Net content of the whole package (g or ml), for the "half the pack" shortcut.
    packageQuantity: Optional[float] = None
    nutriscore: Optional[str] = None
    imageUrl: Optional[str] = None
    isBeverage: bool = False
    # Passed through so the front can match a product to its local GI table.
    categories: list[str] = Field(default_factory=list)


# ---------- Vision: plate ----------


class Box(BaseModel):
    """Normalised bounding box (0-1, origin top-left)."""

    model_config = ConfigDict(extra="ignore")

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(ge=0, le=1)
    h: float = Field(ge=0, le=1)


class PlateItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=120)
    estimatedQuantityG: float = Field(gt=0, le=5000)
    unit: Unit = "g"
    carbsG: float = Field(ge=0, le=2000)
    carbsMinG: float = Field(ge=0, le=2000)
    carbsMaxG: float = Field(ge=0, le=2000)
    sugarsG: Optional[float] = Field(default=None, ge=0)
    fiberG: Optional[float] = Field(default=None, ge=0)
    proteinG: Optional[float] = Field(default=None, ge=0)
    fatG: Optional[float] = Field(default=None, ge=0)
    glycemicIndex: Optional[float] = Field(default=None, ge=0, le=120)
    giCategory: Optional[GiCategory] = None
    box: Optional[Box] = None

    @field_validator("unit", mode="before")
    @classmethod
    def _unit_default(cls, value: object) -> object:
        # Models sometimes answer null for a field they consider unknown.
        return "g" if value is None else value

    @model_validator(mode="after")
    def _coherent(self) -> "PlateItem":
        # The range must always contain the central estimate.
        self.carbsMinG = min(self.carbsMinG, self.carbsG)
        self.carbsMaxG = max(self.carbsMaxG, self.carbsG)
        # Category is derived from the index so both never disagree.
        self.giCategory = gi_category(self.glycemicIndex) if self.glycemicIndex is not None else None
        return self


class PlateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[PlateItem] = Field(max_length=30)
    notes: str = ""
    overallConfidence: Literal["low", "medium", "high"] = "low"


# ---------- Vision: label ----------


class Per100Nullable(BaseModel):
    model_config = ConfigDict(extra="ignore")

    carbs: Optional[float] = Field(default=None, ge=0, le=100)
    sugars: Optional[float] = Field(default=None, ge=0, le=100)
    fiber: Optional[float] = Field(default=None, ge=0, le=100)
    protein: Optional[float] = Field(default=None, ge=0, le=100)
    fat: Optional[float] = Field(default=None, ge=0, le=100)


class LabelExtraction(BaseModel):
    """What the model returns. Unreadable values are null."""

    model_config = ConfigDict(extra="ignore")

    per100: Per100Nullable
    servingQuantity: Optional[float] = Field(default=None, gt=0, le=5000)
    unit: Unit = "g"
    name: Optional[str] = Field(default=None, max_length=120)

    @field_validator("unit", mode="before")
    @classmethod
    def _unit_default(cls, value: object) -> object:
        # An unreadable label yields null everywhere, unit included.
        return "g" if value is None else value


class LabelResponse(LabelExtraction):
    # Values read from a label are manufacturer data, not estimates.
    confidence: Literal["manufacturer"] = "manufacturer"
