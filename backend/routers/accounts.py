"""Cuentas: registro de vendedores, inicio y cierre de sesión, y datos del usuario."""
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    SESSION_COOKIE,
    DUMMY_PASSWORD_HASH,
    check_login_allowed,
    clear_login_failures,
    client_key,
    end_session,
    get_current_user,
    hash_password,
    normalize_email,
    record_login_failure,
    start_session,
    verify_password,
)
from database import get_db
from models import Seller, SellerStatus, User
from schemas import LoginIn, MeOut, SellerRegisterIn
from services.catalog import unique_slug

router = APIRouter(prefix="/api/auth", tags=["Cuentas"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post("/register-seller", response_model=MeOut, status_code=status.HTTP_201_CREATED)
def register_seller(payload: SellerRegisterIn, response: Response, db: DbSession) -> MeOut:
    """Crea la cuenta y la tienda (queda PENDING hasta que un admin la apruebe)."""
    email = normalize_email(payload.email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese correo ya tiene una cuenta")

    user = User(email=email, password_hash=hash_password(payload.password))
    user.seller = Seller(
        store_name=payload.store_name,
        slug=unique_slug(db, Seller.slug, payload.store_name),
        whatsapp=payload.whatsapp,
        pago_movil_bank=payload.pago_movil_bank,
        pago_movil_phone=payload.pago_movil_phone,
        pago_movil_id=payload.pago_movil_id,
        status=SellerStatus.PENDING,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:  # dos registros simultáneos con el mismo correo
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese correo ya tiene una cuenta") from exc
    start_session(db, user, response)
    return MeOut.model_validate(user)


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
