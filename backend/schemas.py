"""Schemas de Pydantic: validación de entrada y forma de las respuestas.

Las respuestas salen en camelCase (priceUsd, imageUrl...) para que encajen
directo con los tipos del frontend en Next.js. La entrada acepta camelCase o snake_case.
"""
import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    field_validator,
)
from pydantic.alias_generators import to_camel

from models import OrderStatus

# Los Decimal se envían como número en el JSON (no como string).
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]

CleanStr = Annotated[str, StringConstraints(strip_whitespace=True)]

CEDULA_RE = re.compile(r"^(?:[VE]-\d{6,8}|[JG]-\d{9})$")
PHONE_RE = re.compile(r"^04(?:12|14|16|24|26)\d{7}$")
REFERENCE_RE = re.compile(r"^\d{4,12}$")


class ApiModel(BaseModel):
    """Base común: alias camelCase y lectura desde objetos ORM."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class InputModel(ApiModel):
    """Base para datos de entrada: rechaza campos desconocidos."""

    model_config = ConfigDict(extra="forbid")


# ---------- Productos ----------


class ProductOut(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str
    price_usd: Money
    original_price_usd: Money | None = None
    stock: int
    image_url: str
    category: str | None = None
    badge: str | None = None
    rating: float
    reviews_count: int
    created_at: datetime


class ProductSummary(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
    image_url: str


# ---------- Clientes ----------


class CustomerIn(InputModel):
    cedula: str = Field(examples=["V-12345678"])
    name: Annotated[CleanStr, StringConstraints(min_length=3, max_length=120)]
    phone: str = Field(examples=["04141234567"])
    address_state: Annotated[CleanStr, StringConstraints(min_length=2, max_length=60)]
    address_city: Annotated[CleanStr, StringConstraints(min_length=2, max_length=80)]
    address_street: Annotated[CleanStr, StringConstraints(min_length=5, max_length=255)]
    address_reference: Annotated[CleanStr, StringConstraints(max_length=255)] | None = None

    @field_validator("cedula")
    @classmethod
    def validate_cedula(cls, value: str) -> str:
        # Normaliza: "v 12.345.678" -> "V-12345678"
        cleaned = re.sub(r"[\s.]", "", value).upper()
        if re.fullmatch(r"[VEJG]\d+", cleaned):
            cleaned = f"{cleaned[0]}-{cleaned[1:]}"
        if not CEDULA_RE.fullmatch(cleaned):
            raise ValueError(
                "Cédula/RIF inválido. Formatos aceptados: V-12345678, E-12345678, "
                "J-123456789 o G-123456789"
            )
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        # Normaliza: "+58 414-123.45.67" -> "04141234567"
        cleaned = re.sub(r"[\s\-().]", "", value)
        if cleaned.startswith("+58"):
            cleaned = "0" + cleaned[3:]
        elif cleaned.startswith("58") and len(cleaned) == 12:
            cleaned = "0" + cleaned[2:]
        if not PHONE_RE.fullmatch(cleaned):
            raise ValueError(
                "Teléfono inválido. Debe ser un móvil venezolano "
                "(0412, 0414, 0416, 0424 o 0426) seguido de 7 dígitos"
            )
        return cleaned


class CustomerOut(ApiModel):
    id: uuid.UUID
    cedula: str
    name: str
    phone: str
    address_state: str
    address_city: str
    address_street: str
    address_reference: str | None = None


# ---------- Checkout ----------


class CartItemIn(InputModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1, le=50)


class CheckoutIn(InputModel):
    customer: CustomerIn
    items: list[CartItemIn] = Field(min_length=1, max_length=50)


class PaymentIn(InputModel):
    """Datos de la confirmación (simulada) del Pago Móvil."""

    reference: str = Field(examples=["123456"], description="Número de referencia del Pago Móvil")

    @field_validator("reference")
    @classmethod
    def validate_reference(cls, value: str) -> str:
        cleaned = value.strip()
        if not REFERENCE_RE.fullmatch(cleaned):
            raise ValueError("La referencia debe tener entre 4 y 12 dígitos")
        return cleaned


# ---------- Órdenes ----------


class OrderItemOut(ApiModel):
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    price_at_purchase: Money
    product: ProductSummary


class OrderOut(ApiModel):
    id: uuid.UUID
    status: OrderStatus
    total_usd: Money
    total_ves: Money
    bcv_rate: Money
    payment_reference: str | None = None
    created_at: datetime
    expires_at: datetime | None = None
    payment_submitted_at: datetime | None = None
    paid_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None
    items: list[OrderItemOut]


class AdminOrderOut(OrderOut):
    customer: CustomerOut


class OrderStatusUpdateIn(InputModel):
    """Cambio de estado hecho por el admin (aprobar pago, enviar, cancelar...)."""

    status: OrderStatus
    reason: Annotated[CleanStr, StringConstraints(max_length=200)] | None = Field(
        default=None, description="Motivo (se guarda al cancelar)"
    )


# ---------- Tasa BCV ----------


class RateOut(ApiModel):
    rate: Money
    source: str
    valid_from: date
    source_date: datetime | None = None
    updated_at: datetime = Field(validation_alias="created_at")


class RateCheckOut(ApiModel):
    at: datetime
    ok: bool
    source: str | None = None
    error: str | None = None


class RateStatusOut(ApiModel):
    """Estado de la tasa para el panel: vigente, la próxima publicada y si está vieja."""

    current: RateOut
    upcoming: RateOut | None = None
    business_days_behind: int
    stale: bool
    last_check: RateCheckOut | None = None


class RateIn(InputModel):
    rate: Decimal = Field(gt=0, le=Decimal("100000000"), max_digits=14, decimal_places=4)
