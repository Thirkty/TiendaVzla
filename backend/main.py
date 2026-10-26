"""Punto de entrada de la API de TiendaVzla (FastAPI)."""
import asyncio
import contextlib
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import BCV_AUTO_UPDATE, CORS_ORIGINS, RATE_REFRESH_HOURS, SessionLocal, engine
from routers import accounts, admin_sellers, orders, products, rates, seller
from services.catalog import UPLOAD_PATH
from services.orders import expire_pending_orders
from services.rates import refresh_official_rate

# Las tablas se crean y actualizan con Alembic: `alembic upgrade head`.

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")
log = logging.getLogger("tiendavzla")

EXPIRE_EVERY_SECONDS = 60


def _expire_orders() -> None:
    with SessionLocal() as db:
        expire_pending_orders(db)


def _refresh_rate() -> None:
    with SessionLocal() as db:
        refresh_official_rate(db)


async def background_jobs() -> None:
    """Cada minuto cancela órdenes vencidas; cada RATE_REFRESH_HOURS actualiza la tasa BCV."""
    next_rate_refresh = 0.0  # la primera vuelta actualiza la tasa al arrancar
    while True:
        try:
            await asyncio.to_thread(_expire_orders)
        except Exception:
            log.exception("Falló la cancelación de órdenes vencidas")

        if BCV_AUTO_UPDATE and time.monotonic() >= next_rate_refresh:
            try:
                await asyncio.to_thread(_refresh_rate)
                next_rate_refresh = time.monotonic() + RATE_REFRESH_HOURS * 3600
            except Exception as exc:
                # Si la fuente falla, se mantiene la última tasa y se reintenta en 15 min.
                log.warning("No se pudo actualizar la tasa BCV: %s", exc)
                next_rate_refresh = time.monotonic() + 15 * 60

        await asyncio.sleep(EXPIRE_EVERY_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(background_jobs())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    engine.dispose()


app = FastAPI(
    title="TiendaVzla API",
    description="Backend del marketplace TiendaVzla: vendedores, catálogo, pedidos y tasa BCV.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,  # la sesión viaja en una cookie
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(rates.router)
app.include_router(accounts.router)
app.include_router(seller.router)
app.include_router(admin_sellers.router)

# Imágenes subidas por los vendedores (en producción conviene servirlas desde un CDN).
app.mount("/uploads", StaticFiles(directory=UPLOAD_PATH), name="uploads")


@app.get("/", tags=["Salud"])
def health() -> dict[str, str]:
    return {"status": "ok"}
