"use client";
// CheckoutForm: datos del cliente (cédula, teléfono, dirección). Valida en el navegador,
// crea la orden con POST /api/checkout y muestra los errores que devuelva la API.

import { useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock } from "lucide-react";
import { ApiError, createOrders } from "@/lib/api/client";
import type { CartItem, CustomerField, CustomerInput, Order } from "@/lib/api/types";
import {
  normalizeCedula,
  normalizePhone,
  validateCustomer,
  VENEZUELA_STATES,
  type FieldErrors,
} from "@/lib/utils/validation";

interface CheckoutFormProps {
  items: CartItem[];
  onCreated: (orders: Order[]) => void;
}

const EMPTY: CustomerInput = {
  cedula: "",
  name: "",
  phone: "",
  addressState: "",
  addressCity: "",
  addressStreet: "",
  addressReference: "",
};

const INPUT_CLASSES =
  "w-full rounded-xl border bg-white px-4 py-3 text-base outline-none transition placeholder:text-ink/35 focus:border-brand focus:ring-4 focus:ring-brand/15";

export default function CheckoutForm({ items, onCreated }: CheckoutFormProps) {
  const [values, setValues] = useState<CustomerInput>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: CustomerField) => (value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const customer: CustomerInput = {
      ...values,
      cedula: normalizeCedula(values.cedula),
      phone: normalizePhone(values.phone),
      addressReference: values.addressReference?.trim() || undefined,
    };
    const found = validateCustomer(customer);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSubmitting(true);
    try {
      onCreated(await createOrders(customer, items));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError("Algo salió mal. Intenta de nuevo.");
      }
      setSubmitting(false);
    }
  };

  const inputProps = (field: CustomerField) => ({
    id: field,
    name: field,
    value: values[field] ?? "",
    onChange: (e: { target: { value: string } }) => set(field)(e.target.value),
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
    className: `${INPUT_CLASSES} ${errors[field] ? "border-brand" : "border-line"}`,
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-bold">Tus datos</legend>
        <Field label="Cédula o RIF" field="cedula" error={errors.cedula}>
          <input
            {...inputProps("cedula")}
            placeholder="V-12345678"
            autoComplete="off"
            onBlur={() => set("cedula")(normalizeCedula(values.cedula))}
          />
        </Field>
        <Field label="Nombre y apellido" field="name" error={errors.name}>
          <input {...inputProps("name")} placeholder="María Pérez" autoComplete="name" />
        </Field>
        <Field
          label="Teléfono (WhatsApp)"
          field="phone"
          error={errors.phone}
          hint="Te escribimos aquí para coordinar el envío"
        >
          <input
            {...inputProps("phone")}
            type="tel"
            inputMode="tel"
            placeholder="0414 1234567"
            autoComplete="tel"
            onBlur={() => set("phone")(normalizePhone(values.phone))}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-lg font-bold">Dirección de envío</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estado" field="addressState" error={errors.addressState}>
            <select {...inputProps("addressState")}>
              <option value="" disabled>
                Selecciona…
              </option>
              {VENEZUELA_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ciudad" field="addressCity" error={errors.addressCity}>
            <input
              {...inputProps("addressCity")}
              placeholder="Valencia"
              autoComplete="address-level2"
            />
          </Field>
        </div>
        <Field label="Dirección" field="addressStreet" error={errors.addressStreet}>
          <input
            {...inputProps("addressStreet")}
            placeholder="Av. Bolívar, Edif. Sol, piso 3, apto 3-B"
            autoComplete="street-address"
          />
        </Field>
        <Field
          label="Punto de referencia (opcional)"
          field="addressReference"
          error={errors.addressReference}
        >
          <input {...inputProps("addressReference")} placeholder="Frente a la panadería" />
        </Field>
      </fieldset>

      {formError && (
        <p role="alert" className="rounded-xl bg-brand/10 px-4 py-3 text-sm font-medium text-brand-dark">
          {formError}
        </p>
      )}

      <motion.button
        type="submit"
        disabled={submitting}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
      >
        {submitting ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
        {submitting ? "Creando tu pedido…" : "Continuar al pago"}
      </motion.button>
    </form>
  );
}

interface FieldProps {
  label: string;
  field: CustomerField;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, field, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={field} className="mb-1.5 block text-sm font-semibold text-ink/80">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${field}-error`} className="mt-1.5 text-sm text-brand-dark">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink/50">{hint}</p>
      )}
    </div>
  );
}
