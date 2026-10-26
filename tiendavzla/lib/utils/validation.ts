// Validaciones del checkout. Son las mismas reglas de backend/schemas.py,
// repetidas aquí solo para dar feedback inmediato; el backend sigue siendo quien decide.
import type { CustomerField, CustomerInput } from "@/lib/api/types";

const CEDULA_RE = /^(?:[VE]-\d{6,8}|[JG]-\d{9})$/;
const PHONE_RE = /^04(?:12|14|16|24|26)\d{7}$/;
const REFERENCE_RE = /^\d{4,12}$/;

/** "v 12.345.678" -> "V-12345678" */
export function normalizeCedula(value: string): string {
  const cleaned = value.replace(/[\s.]/g, "").toUpperCase();
  return /^[VEJG]\d+$/.test(cleaned) ? `${cleaned[0]}-${cleaned.slice(1)}` : cleaned;
}

/** "+58 414-123.45.67" -> "04141234567" */
export function normalizePhone(value: string): string {
  let cleaned = value.replace(/[\s\-().]/g, "");
  if (cleaned.startsWith("+58")) cleaned = `0${cleaned.slice(3)}`;
  else if (cleaned.startsWith("58") && cleaned.length === 12) cleaned = `0${cleaned.slice(2)}`;
  return cleaned;
}

export type FieldErrors = Partial<Record<CustomerField, string>>;

/** Devuelve los errores por campo (objeto vacío si todo está bien). */
export function validateCustomer(c: CustomerInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!CEDULA_RE.test(normalizeCedula(c.cedula))) {
    errors.cedula = "Usa el formato V-12345678 (o J-123456789 si es RIF)";
  }
  if (c.name.trim().length < 3) {
    errors.name = "Escribe tu nombre y apellido";
  }
  if (!PHONE_RE.test(normalizePhone(c.phone))) {
    errors.phone = "Debe ser un móvil 0412, 0414, 0416, 0424 o 0426 + 7 dígitos";
  }
  if (!c.addressState) {
    errors.addressState = "Selecciona tu estado";
  }
  if (c.addressCity.trim().length < 2) {
    errors.addressCity = "Escribe tu ciudad";
  }
  if (c.addressStreet.trim().length < 5) {
    errors.addressStreet = "Indica calle, casa o edificio";
  }
  return errors;
}

export function isValidReference(value: string): boolean {
  return REFERENCE_RE.test(value.trim());
}

export const VENEZUELA_STATES = [
  "Amazonas",
  "Anzoátegui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolívar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Distrito Capital",
  "Falcón",
  "Guárico",
  "La Guaira",
  "Lara",
  "Mérida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Táchira",
  "Trujillo",
  "Yaracuy",
  "Zulia",
] as const;
