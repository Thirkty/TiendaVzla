"use client";
// StoreSettingsForm: nombre, WhatsApp y Pago Móvil de la tienda. Son los datos que ve
// el cliente al pagar, así que conviene revisarlos con cuidado.

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { SessionApiError } from "@/lib/api/session";
import type { StoreSettings } from "@/lib/api/types";
import { FormError, primaryButton } from "@/components/ui/form";
import StoreProfileFields from "./StoreProfileFields";

// Valores de ejemplo que deja la migración: si siguen ahí, se avisa.
const PLACEHOLDER_IDS = new Set(["V-00000000"]);

export default function StoreSettingsForm({ onApiError }: { onApiError: (err: unknown) => void }) {
  const [values, setValues] = useState<StoreSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.store().then(setValues).catch((err) => {
      onApiError(err);
      setFormError("No se pudo cargar la configuración.");
    });
  }, [onApiError]);

  if (!values) return <div className="h-64 max-w-xl animate-pulse rounded-2xl bg-line/50" />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setMessage(null);
    try {
      setValues(await adminApi.updateStore(values));
      setMessage("Datos guardados. Los pedidos nuevos ya muestran estos datos de pago.");
    } catch (err) {
      onApiError(err);
      if (err instanceof SessionApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError("No se pudo guardar.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-4">
      {PLACEHOLDER_IDS.has(values.pagoMovilId) && (
        <p role="alert" className="flex gap-2 rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand-dark">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Los datos de Pago Móvil son de ejemplo. Cámbialos antes de recibir pedidos reales: son
          los que ven los clientes al pagar.
        </p>
      )}
      <StoreProfileFields
        values={values}
        errors={errors}
        onChange={(field, value) => {
          setValues((v) => (v ? { ...v, [field]: value } : v));
          setErrors((er) => ({ ...er, [field]: "" }));
        }}
      />
      <FormError message={formError} />
      {message && <p className="text-sm font-medium text-deep">{message}</p>}
      <button type="submit" disabled={saving} className={primaryButton}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        Guardar
      </button>
    </form>
  );
}
