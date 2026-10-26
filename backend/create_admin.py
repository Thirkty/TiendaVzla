"""Crea (o promueve) una cuenta de administrador y le asigna la tienda de la casa.

Uso (desde backend/ con el venv activo):
    python create_admin.py

Pide el correo y la contraseña por teclado (la contraseña no se muestra). Si el correo
ya existe, solo lo marca como admin. Si la tienda "TiendaVzla" no tiene dueño, se la
asigna, para que el admin maneje esos productos desde /vendedor.
"""
import getpass
import sys

from sqlalchemy import select

from auth import MIN_PASSWORD_LENGTH, hash_password, normalize_email
from database import SessionLocal
from models import Seller, User

HOUSE_STORE_SLUG = "tiendavzla"


def main() -> int:
    email = normalize_email(input("Correo del admin: "))
    if "@" not in email:
        print("Correo inválido.")
        return 1

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            password = getpass.getpass(f"Contraseña (mínimo {MIN_PASSWORD_LENGTH} caracteres): ")
            if len(password) < MIN_PASSWORD_LENGTH:
                print("La contraseña es muy corta.")
                return 1
            if password != getpass.getpass("Repite la contraseña: "):
                print("Las contraseñas no coinciden.")
                return 1
            user = User(email=email, password_hash=hash_password(password), is_admin=True)
            db.add(user)
            print(f"Cuenta creada: {email}")
        else:
            user.is_admin = True
            print(f"La cuenta {email} ya existía; ahora es admin.")
        db.flush()

        house = db.scalar(select(Seller).where(Seller.slug == HOUSE_STORE_SLUG))
        if house is not None and house.user_id is None and user.seller is None:
            house.user_id = user.id
            print('Tienda "TiendaVzla" asignada a esta cuenta (gestiónala en /vendedor).')
        db.commit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
