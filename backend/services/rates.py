"""Tasa BCV: lectura de la tasa vigente y actualización desde la fuente oficial.

Fuentes, en orden:
  1. bcv.org.ve: la tasa oficial y su "Fecha Valor" (el día desde el que rige).
  2. DolarApi: respaldo si el sitio del BCV no responde o cambia su HTML.

Cada tasa se guarda con `valid_from` (la fecha valor). La vigente es la más reciente
con valid_from <= hoy en Venezuela, así la tasa que el BCV publica en la tarde para
el día siguiente empieza a usarse justo a las 00:00, sin depender de cuándo se consultó.
"""
import logging
import re
import ssl
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from functools import cache
from pathlib import Path

import certifi
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import BCV_API_URL, BCV_RATE, BCV_URL
from models import ExchangeRate

log = logging.getLogger("tiendavzla.rates")

RATE_PRECISION = Decimal("0.0001")
VE_TZ = timezone(timedelta(hours=-4))  # Venezuela no usa horario de verano
HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (TiendaVzla; tasa BCV)"}

# Días hábiles de atraso a partir de los cuales la tasa se considera vieja.
# Se tolera 1 para no alertar por un feriado bancario.
STALE_BUSINESS_DAYS = 2

# bcv.org.ve envía una cadena de certificados incompleta: le falta el intermedio
# "Sectigo Public Server Authentication CA DV R36". Lo incluimos en certs/ (descargado
# de crt.sectigo.com y firmado por una raíz que ya está en certifi). La verificación
# TLS sigue completa; si el BCV cambia de certificado y falla, se usa DolarApi.
BCV_EXTRA_CA = Path(__file__).resolve().parents[1] / "certs" / "sectigo-dv-r36.pem"


@cache
def _bcv_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context(cafile=certifi.where())
    if BCV_EXTRA_CA.exists():
        ctx.load_verify_locations(cafile=BCV_EXTRA_CA)
    return ctx


_DOLAR_RE = re.compile(r'id="dolar".*?<strong[^>]*>\s*([\d.,]+)\s*</strong>', re.S)
_FECHA_VALOR_RE = re.compile(r'Fecha Valor:.*?content="(\d{4}-\d{2}-\d{2})', re.S)


def today_ve() -> date:
    return datetime.now(VE_TZ).date()


@dataclass(frozen=True)
class FetchedRate:
    rate: Decimal
    valid_from: date
    source: str  # "bcv" o "dolarapi"
    source_date: datetime | None = None


@dataclass(frozen=True)
class RateCheck:
    """Resultado de la última consulta a las fuentes (se guarda en memoria del proceso)."""

    at: datetime
    ok: bool
    source: str | None
    error: str | None


last_check: RateCheck | None = None


# ---------- Fuentes ----------


def _parse_ve_number(text: str) -> Decimal:
    """'887,30200000' o '1.234,56' -> Decimal"""
    return Decimal(text.replace(".", "").replace(",", "."))


def parse_bcv_html(html: str) -> tuple[Decimal, date]:
    """Extrae (tasa USD, fecha valor) de la portada de bcv.org.ve."""
    rate_match = _DOLAR_RE.search(html)
    date_match = _FECHA_VALOR_RE.search(html)
    if not rate_match or not date_match:
        raise RuntimeError("El HTML del BCV cambió: no se encontró la tasa o la fecha valor")
    try:
        rate = _parse_ve_number(rate_match.group(1))
    except InvalidOperation as exc:
        raise RuntimeError(f"Tasa del BCV ilegible: {rate_match.group(1)!r}") from exc
    return rate, date.fromisoformat(date_match.group(1))


def fetch_bcv() -> FetchedRate:
    try:
        res = httpx.get(
            BCV_URL,
            timeout=20,
            headers=HTTP_HEADERS,
            follow_redirects=True,
            verify=_bcv_ssl_context(),
        )
        res.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"bcv.org.ve no respondió: {exc}") from exc
    rate, valid_from = parse_bcv_html(res.text)
    return FetchedRate(rate=rate, valid_from=valid_from, source="bcv")


def fetch_dolarapi() -> FetchedRate:
    try:
        res = httpx.get(BCV_API_URL, timeout=10, headers=HTTP_HEADERS)
        res.raise_for_status()
        data = res.json()
        rate = Decimal(str(data["promedio"]))
    except (httpx.HTTPError, KeyError, ValueError, InvalidOperation) as exc:
        raise RuntimeError(f"DolarApi no respondió bien: {exc}") from exc

    published = data.get("fechaActualizacion")
    try:
        source_date = datetime.fromisoformat(published) if published else None
    except ValueError:
        source_date = None
    # DolarApi no informa la fecha valor; usamos su fecha de actualización, que es
    # igual o anterior. Así nunca le gana a una tasa más nueva leída del BCV.
    valid_from = source_date.astimezone(VE_TZ).date() if source_date else today_ve()
    return FetchedRate(rate=rate, valid_from=valid_from, source="dolarapi", source_date=source_date)


def fetch_official_rate() -> FetchedRate:
    """Consulta el BCV y, si falla, DolarApi. Lanza RuntimeError si fallan las dos."""
    errors = []
    for fetch in (fetch_bcv, fetch_dolarapi):
        try:
            fetched = fetch()
        except RuntimeError as exc:
            log.warning("%s", exc)
            errors.append(str(exc))
            continue
        if not Decimal("0") < fetched.rate < Decimal("100000000"):
            errors.append(f"{fetched.source} devolvió una tasa fuera de rango: {fetched.rate}")
            continue
        return fetched
    raise RuntimeError(" · ".join(errors))


# ---------- Base de datos ----------


def get_current_rate(db: Session) -> ExchangeRate:
    """Tasa vigente hoy. Si no hay ninguna guardada, registra la del .env."""
    current = db.scalar(
        select(ExchangeRate)
        .where(ExchangeRate.valid_from <= today_ve())
        .order_by(
            ExchangeRate.valid_from.desc(), ExchangeRate.created_at.desc(), ExchangeRate.id.desc()
        )
        .limit(1)
    )
    if current is None:
        current = set_rate(db, BCV_RATE, source="env")
    return current


def get_upcoming_rate(db: Session) -> ExchangeRate | None:
    """Tasa ya publicada que empieza a regir en un día futuro (p. ej. la de mañana)."""
    return db.scalar(
        select(ExchangeRate)
        .where(ExchangeRate.valid_from > today_ve())
        .order_by(ExchangeRate.valid_from.asc(), ExchangeRate.created_at.desc())
        .limit(1)
    )


def set_rate(
    db: Session,
    rate: Decimal,
    *,
    source: str,
    valid_from: date | None = None,
    source_date: datetime | None = None,
) -> ExchangeRate:
    """Registra una tasa y hace commit. Sin valid_from, rige desde hoy."""
    entry = ExchangeRate(
        rate=rate.quantize(RATE_PRECISION),
        source=source,
        valid_from=valid_from or today_ve(),
        source_date=source_date,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def refresh_official_rate(db: Session, *, restore_official: bool = False) -> ExchangeRate:
    """Consulta la tasa oficial y la guarda si es nueva. Devuelve la tasa vigente hoy.

    Con restore_official=True (botón "Consultar BCV" del admin), si hoy rige una tasa
    fijada a mano se vuelve a la última oficial: así un error al fijarla se deshace.
    """
    global last_check
    try:
        fetched = fetch_official_rate()
    except RuntimeError as exc:
        last_check = RateCheck(at=datetime.now(timezone.utc), ok=False, source=None, error=str(exc))
        raise
    last_check = RateCheck(at=datetime.now(timezone.utc), ok=True, source=fetched.source, error=None)

    rate = fetched.rate.quantize(RATE_PRECISION)
    exists = db.scalar(
        select(ExchangeRate.id).where(
            ExchangeRate.source == fetched.source,
            ExchangeRate.valid_from == fetched.valid_from,
            ExchangeRate.rate == rate,
        )
    )
    if exists is None:
        log.info(
            "Nueva tasa %s: %s Bs/$ (rige desde %s)", fetched.source, rate, fetched.valid_from
        )
        set_rate(
            db,
            rate,
            source=fetched.source,
            valid_from=fetched.valid_from,
            source_date=fetched.source_date,
        )

    current = get_current_rate(db)
    if restore_official and current.source in ("manual", "env"):
        official = db.scalar(
            select(ExchangeRate)
            .where(
                ExchangeRate.source.in_(("bcv", "dolarapi")),
                ExchangeRate.valid_from <= today_ve(),
            )
            .order_by(ExchangeRate.valid_from.desc(), ExchangeRate.created_at.desc())
            .limit(1)
        )
        if official is not None:
            log.info("Se vuelve a la tasa oficial %s (se deja la manual %s)", official.rate, current.rate)
            # Se registra de nuevo con fecha valor de hoy para que le gane a la manual.
            current = set_rate(
                db, official.rate, source=official.source, source_date=official.source_date
            )
    return current


# ---------- Alerta de tasa vieja ----------


def last_business_day(day: date) -> date:
    """El día hábil (lunes a viernes) más reciente <= day."""
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    return day


def business_days_behind(valid_from: date, today: date | None = None) -> int:
    """Cuántos días hábiles hay entre la fecha valor vigente y el último día hábil."""
    expected = last_business_day(today or today_ve())
    behind, day = 0, valid_from
    while day < expected:
        day += timedelta(days=1)
        if day.weekday() < 5:
            behind += 1
    return behind
