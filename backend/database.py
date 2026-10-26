"""Conexión a PostgreSQL con SQLAlchemy 2.0 y configuración leída del .env."""
import os
from collections.abc import Generator
from decimal import Decimal, InvalidOperation

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Falta la variable de entorno {name}. Revisa tu archivo .env")
    return value


# ---------- Configuración ----------

DATABASE_URL = _require_env("DATABASE_URL")
ADMIN_API_KEY = _require_env("ADMIN_API_KEY")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Tasa inicial: solo se usa si la tabla exchange_rates está vacía y no se pudo
# consultar la tasa oficial. Después la tasa vive en la base de datos.
try:
    BCV_RATE = Decimal(os.getenv("BCV_RATE", "40"))
    if BCV_RATE <= 0:
        raise InvalidOperation
except InvalidOperation as exc:
    raise RuntimeError("BCV_RATE debe ser un número mayor que 0") from exc

# Actualización automática de la tasa oficial (dolarapi publica la del BCV).
BCV_AUTO_UPDATE = os.getenv("BCV_AUTO_UPDATE", "true").lower() == "true"
BCV_API_URL = os.getenv("BCV_API_URL", "https://ve.dolarapi.com/v1/dolares/oficial")
RATE_REFRESH_HOURS = float(os.getenv("RATE_REFRESH_HOURS", "6"))

# Minutos que una orden PENDING aparta el stock antes de cancelarse sola.
ORDER_TTL_MINUTES = int(os.getenv("ORDER_TTL_MINUTES", "120"))

SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"

# ---------- SQLAlchemy ----------

engine = create_engine(
    DATABASE_URL,
    echo=SQL_ECHO,
    pool_pre_ping=True,  # descarta conexiones caídas antes de usarlas
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: abre una sesión por request y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
