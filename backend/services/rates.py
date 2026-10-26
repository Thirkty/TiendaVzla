"""Tasa BCV: lectura de la tasa vigente y actualización desde la fuente oficial."""
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import BCV_API_URL, BCV_RATE
from models import ExchangeRate

log = logging.getLogger("tiendavzla.rates")

RATE_PRECISION = Decimal("0.0001")


def get_current_rate(db: Session) -> ExchangeRate:
    """Devuelve la tasa vigente. Si no hay ninguna guardada, registra la del .env."""
    current = db.scalar(select(ExchangeRate).order_by(ExchangeRate.created_at.desc(), ExchangeRate.id.desc()).limit(1))
    if current is None:
        current = set_rate(db, BCV_RATE, source="env")
    return current


def set_rate(
    db: Session, rate: Decimal, *, source: str, source_date: datetime | None = None
) -> ExchangeRate:
    """Registra una nueva tasa (queda como vigente) y hace commit."""
    entry = ExchangeRate(
        rate=rate.quantize(RATE_PRECISION), source=source, source_date=source_date
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def fetch_official_rate() -> tuple[Decimal, datetime | None]:
    """Consulta la tasa oficial del BCV. Lanza RuntimeError si la respuesta no sirve."""
    try:
        res = httpx.get(BCV_API_URL, timeout=10)
        res.raise_for_status()
        data = res.json()
        rate = Decimal(str(data["promedio"]))
    except (httpx.HTTPError, KeyError, ValueError, InvalidOperation) as exc:
        raise RuntimeError(f"No se pudo obtener la tasa oficial: {exc}") from exc
    if rate <= 0:
        raise RuntimeError(f"La fuente devolvió una tasa inválida: {rate}")

    published = data.get("fechaActualizacion")
    try:
        source_date = datetime.fromisoformat(published) if published else None
    except ValueError:
        source_date = None
    return rate, source_date


def refresh_official_rate(db: Session) -> ExchangeRate:
    """Trae la tasa oficial y la guarda solo si cambió. Devuelve la tasa vigente."""
    rate, source_date = fetch_official_rate()
    current = get_current_rate(db)
    if current.rate == rate.quantize(RATE_PRECISION) and current.source == "bcv":
        return current
    log.info("Tasa BCV actualizada: %s -> %s", current.rate, rate)
    return set_rate(db, rate, source="bcv", source_date=source_date)
