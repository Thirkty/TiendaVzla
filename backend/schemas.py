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
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    computed_field,
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
BANK_RE = re.compile(r"^\d{4} - .{2,70}$")  # "0134 - Banesco"


def _normalize_cedula(value: str) -> str:
    """'v 12.345.678' -> 'V-12345678'"""
    cleaned = re.sub(r"[\s.]", "", value).upper()
    if re.fullmatch(r"[VEJG]\d+", cleaned):
        cleaned = f"{cleaned[0]}-{cleaned[1:]}"
    if not CEDULA_RE.fullmatch(cleaned):
        raise ValueError(
            "Cédula/RIF inválido. Formatos aceptados: V-12345678, E-12345678, "
            "J-123456789 o G-123456789"
        )
    return cleaned


def _normalize_phone(value: str) -> str:
    """'+58 414-123.45.67' -> '04141234567'"""
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


def _check_bank(value: str) -> str:
    value = value.strip()
    if not BANK_RE.fullmatch(value):
        raise ValueError("Elige el banco de la lista (ej: 0134 - Banesco)")
    return value


Cedula = Annotated[str, AfterValidator(_normalize_cedula), Field(examples=["V-12345678"])]
VePhone = Annotated[str, AfterValidator(_normalize_phone), Field(examples=["04141234567"])]
BankName = Annotated[str, AfterValidator(_check_bank), Field(examples=["0134 - Banesco"])]


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


class SellerSummary(ApiModel):
    """Lo que el catálogo muestra del vendedor."""

    id: uuid.UUID
    store_name: str
    slug: str


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
    shipping_cost_usd: Money
    seller: SellerSummary
    created_at: datetime


class ProductSummary(ApiModel):
    id: uuid.UUID
    slug: str
    name: str
    image_url: str


# ---------- Clientes ----------


class CustomerIn(InputModel):
    cedula: Cedula
    name: Annotated[CleanStr, StringConstraints(min_length=3, max_length=120)]
    phone: VePhone
    address_state: Annotated[CleanStr, StringConstraints(min_length=2, max_length=60)]
    address_city: Annotated[CleanStr, StringConstraints(min_length=2, max_length=80)]
    address_street: Annotated[CleanStr, StringConstraints(min_length=5, max_length=255)]
    address_reference: Annotated[CleanStr, StringConstraints(max_length=255)] | None = None


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


class OrderSellerOut(ApiModel):
    """Datos del vendedor que el cliente necesita para pagarle y contactarlo."""

    store_name: str
    slug: str
    whatsapp: str
    pago_movil_bank: str
    pago_movil_phone: str
    pago_movil_id: str


class OrderOut(ApiModel):
    id: uuid.UUID
    checkout_id: uuid.UUID
    status: OrderStatus
    seller: OrderSellerOut
    subtotal_usd: Money
    shipping_usd: Money
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
    carrier: str | None = None
    tracking_number: str | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None
    items: list[OrderItemOut]


class CheckoutOut(ApiModel):
    """Resultado del checkout: una orden por vendedor, cada una se paga por separado."""

    checkout_id: uuid.UUID
    orders: list[OrderOut]


class ShippingOut(ApiModel):
    """Datos de contacto y envío escritos por el cliente en el pedido."""

    name: str
    cedula: str
    phone: str
    address_state: str
    address_city: str
    address_street: str
    address_reference: str | None = None


class SupplierSummary(ApiModel):
    id: uuid.UUID
    name: str
    whatsapp: str


class AdminOrderItemOut(OrderItemOut):
    """Item con costo y proveedor: SOLO para el admin (el cliente nunca ve el costo)."""

    cost_at_purchase: Money | None = None
    supplier: SupplierSummary | None = None


class AdminOrderOut(OrderOut):
    shipping: ShippingOut  # datos de envío de ESTE pedido
    customer: CustomerOut  # cliente vinculado por cédula (datos de su primera compra)
    items: list[AdminOrderItemOut]
    supplier_requested_at: datetime | None = None

    @computed_field
    @property
    def cost_usd(self) -> Money | None:
        """Costo de la mercancía del pedido; None si a algún item le falta el costo."""
        if any(i.cost_at_purchase is None for i in self.items):
            return None
        return sum((i.cost_at_purchase * i.quantity for i in self.items), Decimal("0"))

    @computed_field
    @property
    def profit_usd(self) -> Money | None:
        """Ganancia = productos cobrados - costo (el envío cobrado se asume para el envío)."""
        cost = self.cost_usd
        return None if cost is None else self.subtotal_usd - cost


class SupplierMessageOut(ApiModel):
    """Mensaje de WhatsApp listo para pedirle a un proveedor los items de un pedido."""

    supplier: SupplierSummary
    message: str
    whatsapp_url: str


class SupplierRequestOut(ApiModel):
    messages: list[SupplierMessageOut]
    missing_supplier: list[str]  # productos del pedido sin proveedor asignado


class OrderStatusUpdateIn(InputModel):
    """Cambio de estado (aprobar pago, despachar, cancelar...) por el vendedor o el admin."""

    status: OrderStatus
    reason: Annotated[CleanStr, StringConstraints(max_length=200)] | None = Field(
        default=None, description="Motivo (se guarda al cancelar)"
    )
    carrier: Annotated[CleanStr, StringConstraints(max_length=40)] | None = Field(
        default=None, description="Agencia (obligatoria al pasar a SHIPPED)"
    )
    tracking_number: Annotated[CleanStr, StringConstraints(min_length=1, max_length=60)] | None = Field(
        default=None, description="Número de guía (obligatorio al pasar a SHIPPED)"
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


# ---------- Cuentas ----------

Email = Annotated[
    CleanStr,
    StringConstraints(min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class LoginIn(InputModel):
    email: Email
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class StoreSettingsIn(InputModel):
    """Configuración de la tienda: nombre, WhatsApp y Pago Móvil donde se cobra."""

    store_name: Annotated[CleanStr, StringConstraints(min_length=3, max_length=80)]
    whatsapp: VePhone
    pago_movil_bank: BankName
    pago_movil_phone: VePhone
    pago_movil_id: Cedula


class StoreSettingsOut(ApiModel):
    store_name: str
    whatsapp: str
    pago_movil_bank: str
    pago_movil_phone: str
    pago_movil_id: str


class MeOut(ApiModel):
    id: uuid.UUID
    email: str
    is_admin: bool


# ---------- Productos (admin) ----------


class SellerProductIn(InputModel):
    name: Annotated[CleanStr, StringConstraints(min_length=3, max_length=200)]
    description: Annotated[CleanStr, StringConstraints(max_length=5000)] = ""
    price_usd: Decimal = Field(gt=0, le=Decimal("1000000"), decimal_places=2)
    original_price_usd: Decimal | None = Field(default=None, gt=0, le=Decimal("1000000"), decimal_places=2)
    shipping_cost_usd: Decimal = Field(default=Decimal("0"), ge=0, le=Decimal("10000"), decimal_places=2)
    stock: int = Field(ge=0, le=100000)
    image_url: Annotated[str, StringConstraints(min_length=1, max_length=500)]
    category: Annotated[CleanStr, StringConstraints(max_length=80)] | None = None
    badge: Annotated[CleanStr, StringConstraints(max_length=40)] | None = None
    is_active: bool = True


class SellerProductPatch(InputModel):
    """Edición parcial: solo se cambian los campos enviados."""

    name: Annotated[CleanStr, StringConstraints(min_length=3, max_length=200)] | None = None
    description: Annotated[CleanStr, StringConstraints(max_length=5000)] | None = None
    price_usd: Decimal | None = Field(default=None, gt=0, le=Decimal("1000000"), decimal_places=2)
    original_price_usd: Decimal | None = Field(default=None, gt=0, le=Decimal("1000000"), decimal_places=2)
    shipping_cost_usd: Decimal | None = Field(default=None, ge=0, le=Decimal("10000"), decimal_places=2)
    stock: int | None = Field(default=None, ge=0, le=100000)
    image_url: Annotated[str, StringConstraints(min_length=1, max_length=500)] | None = None
    category: Annotated[CleanStr, StringConstraints(max_length=80)] | None = None
    badge: Annotated[CleanStr, StringConstraints(max_length=40)] | None = None
    is_active: bool | None = None


class OfferOut(ApiModel):
    """Un proveedor que tiene el producto, con su costo."""

    id: uuid.UUID
    supplier: SupplierSummary
    cost_usd: Money
    supplier_sku: str | None = None
    is_preferred: bool


class SellerProductOut(ProductOut):
    is_active: bool
    updated_at: datetime | None = None
    offers: list[OfferOut] = []

    @computed_field
    @property
    def cost_usd(self) -> Money | None:
        """Costo con el proveedor preferido (o el más barato si no hay preferido)."""
        if not self.offers:
            return None
        preferred = [o for o in self.offers if o.is_preferred]
        return (preferred[0] if preferred else min(self.offers, key=lambda o: o.cost_usd)).cost_usd


class OfferIn(InputModel):
    supplier_id: uuid.UUID
    cost_usd: Decimal = Field(ge=0, le=Decimal("1000000"), decimal_places=2)
    supplier_sku: Annotated[CleanStr, StringConstraints(max_length=80)] | None = None
    is_preferred: bool = False


class ProductOffersIn(InputModel):
    """Lista completa de proveedores del producto (reemplaza la anterior)."""

    offers: list[OfferIn] = Field(max_length=20)


# ---------- Proveedores ----------


class SupplierIn(InputModel):
    name: Annotated[CleanStr, StringConstraints(min_length=2, max_length=120)]
    whatsapp: VePhone
    contact_name: Annotated[CleanStr, StringConstraints(max_length=120)] | None = None
    notes: Annotated[CleanStr, StringConstraints(max_length=2000)] | None = None
    dispatch_days: int | None = Field(default=None, ge=0, le=90)
    is_active: bool = True


class SupplierOut(ApiModel):
    id: uuid.UUID
    name: str
    whatsapp: str
    contact_name: str | None = None
    notes: str | None = None
    dispatch_days: int | None = None
    is_active: bool
    created_at: datetime
    products_count: int = 0


# ---------- Reportes ----------


class SalesSummaryOut(ApiModel):
    """Resumen de ventas de pedidos pagados (PAID en adelante, sin cancelados)."""

    days: int
    orders: int
    revenue_usd: Money  # productos cobrados
    shipping_usd: Money  # envío cobrado
    cost_usd: Money  # costo de los items con costo conocido
    profit_usd: Money  # revenue de esos items - su costo
    margin_pct: float | None  # profit / revenue de los items con costo
    items_without_cost: int  # unidades vendidas sin costo cargado


class UploadOut(ApiModel):
    url: str
