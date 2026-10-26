"""Punto de entrada de la API de TiendaVzla (FastAPI)."""
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401  (registra los modelos antes de crear las tablas)
from database import CORS_ORIGINS, Base, engine
from routers import orders, products


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Crea las tablas si no existen. Cuando el esquema empiece a cambiar,
    # conviene migrar a Alembic.
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


app = FastAPI(
    title="TiendaVzla API",
    description="Backend del e-commerce de dropshipping nacional.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Admin-Key"],
)

app.include_router(products.router)
app.include_router(orders.router)


@app.get("/", tags=["Salud"])
def health() -> dict[str, str]:
    return {"status": "ok"}
