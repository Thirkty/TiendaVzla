"""Cuentas y sesiones: contraseñas con Argon2, sesión en cookie httpOnly y dependencias
para proteger endpoints (usuario conectado, admin, vendedor).

La cookie solo lleva un token aleatorio; en la base se guarda su hash SHA-256, así una
copia de la base no sirve para entrar. Cerrar sesión borra la fila.
"""
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database import COOKIE_SECURE, SESSION_DAYS, get_db
from models import Seller, User, UserSession

SESSION_COOKIE = "tvz_session"
MIN_PASSWORD_LENGTH = 8

_hasher = PasswordHasher()
# Hash de una contraseña cualquiera: se verifica contra él cuando el correo no existe,
# para que la respuesta tarde lo mismo y no revele qué correos están registrados.
DUMMY_PASSWORD_HASH = _hasher.hash("contraseña-que-nadie-usa")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def normalize_email(email: str) -> str:
    return email.strip().lower()


# ---------- Límite de intentos de login ----------

LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW_SECONDS = 15 * 60
_failures: dict[str, list[float]] = {}


def check_login_allowed(key: str) -> None:
    now = time.monotonic()
    recent = [t for t in _failures.get(key, []) if now - t < LOGIN_WINDOW_SECONDS]
    _failures[key] = recent
    if len(recent) >= LOGIN_MAX_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espera unos minutos y vuelve a probar.",
        )


def record_login_failure(key: str) -> None:
    _failures.setdefault(key, []).append(time.monotonic())


def clear_login_failures(key: str) -> None:
    _failures.pop(key, None)


# ---------- Sesiones ----------


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(db: Session, user: User, response: Response) -> None:
    """Crea la sesión, guarda su hash y pone la cookie en la respuesta."""
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=_token_hash(token),
            expires_at=now + timedelta(days=SESSION_DAYS),
        )
    )
    user.last_login_at = now
    # Limpieza de paso: sesiones vencidas de este usuario.
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at < now))
    db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def end_session(db: Session, token: str | None, response: Response) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == _token_hash(token)))
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=COOKIE_SECURE, samesite="lax")


# ---------- Dependencias ----------


def get_optional_user(
    db: Annotated[Session, Depends(get_db)],
    tvz_session: Annotated[str | None, Cookie()] = None,
) -> User | None:
    if not tvz_session:
        return None
    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == _token_hash(tvz_session),
            UserSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if session is None or not session.user.is_active:
        return None
    return session.user


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inicia sesión")
    return user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo para administradores")
    return user


def get_current_seller(user: Annotated[User, Depends(get_current_user)]) -> Seller:
    """Tienda del usuario conectado (pendiente, activa o suspendida)."""
    if user.seller is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esta cuenta no tiene tienda")
    return user.seller


def client_key(request: Request, email: str) -> str:
    """Clave para el límite de intentos: correo + IP."""
    host = request.client.host if request.client else "?"
    return f"{normalize_email(email)}|{host}"
