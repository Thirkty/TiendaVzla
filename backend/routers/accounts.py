"""Cuentas: inicio y cierre de sesión y datos del usuario conectado.

No hay registro público: las cuentas de admin se crean con create_admin.py.
"""
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import (
    SESSION_COOKIE,
    DUMMY_PASSWORD_HASH,
    check_login_allowed,
    clear_login_failures,
    client_key,
    end_session,
    get_current_user,
    normalize_email,
    record_login_failure,
    start_session,
    verify_password,
)
from database import get_db
from models import User
from schemas import LoginIn, MeOut

router = APIRouter(prefix="/api/auth", tags=["Cuentas"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post("/login", response_model=MeOut)
def login(payload: LoginIn, request: Request, response: Response, db: DbSession) -> MeOut:
    key = client_key(request, payload.email)
    check_login_allowed(key)

    user = db.scalar(select(User).where(User.email == normalize_email(payload.email)))
    # Se verifica siempre una contraseña (aunque el correo no exista) para no revelar
    # qué correos están registrados por el tiempo de respuesta.
    valid = verify_password(user.password_hash if user else DUMMY_PASSWORD_HASH, payload.password)
    if user is None or not valid or not user.is_active:
        record_login_failure(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Correo o contraseña incorrectos")

    clear_login_failures(key)
    start_session(db, user, response)
    return MeOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbSession,
    tvz_session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> None:
    end_session(db, tvz_session, response)


@router.get("/me", response_model=MeOut)
def me(user: Annotated[User, Depends(get_current_user)]) -> MeOut:
    return MeOut.model_validate(user)
