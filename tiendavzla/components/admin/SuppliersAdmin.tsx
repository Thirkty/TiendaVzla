"use client";
// SuppliersAdmin: proveedores de la tienda (a quién se le compra y se le pide por WhatsApp).
// Los costos de cada producto con cada proveedor se cargan en el editor de productos.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, Pencil, Plus } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { SessionApiError } from "@/lib/api/session";
import type { Supplier, SupplierInput } from "@/lib/api/types";
import { Field, FormError, inputClass, primaryButton, secondaryButton } from "@/components/ui/form";

const EMPTY: SupplierInput = {
  name: "",
  whatsapp: "",
  contactName: null,
  notes: null,
  dispatchDays: null,
  isActive: true,
};

export default function SuppliersAdmin({ onApiError }: { onApiError: (err: unknown) => void }) {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSuppliers(await adminApi.suppliers());
    } catch (err) {
      onApiError(err);
      setError("No se pudieron cargar los proveedores.");
    }
  }, [onApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const saved = () => {
    setEditing(null);
    void load();
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/60">
          A quién le compras cada producto. Al aprobar un pedido le escribes desde el panel.
        </p>
        {editing === null && (
          <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
            <Plus className="size-4" />
            Nuevo proveedor
          </button>
        )}
      </div>

      <FormError message={error} />

      {editing !== null && (
        <SupplierForm
          supplier={editing === "new" ? null : editing}
          onSaved={saved}
          onCancel={() => setEditing(null)}
          onApiError={onApiError}
        />
      )}

      {suppliers?.length === 0 && editing === null && (
        <div className="mt-6 rounded-2xl border border-dashed border-line py-16 text-center text-ink/60">
          Aún no hay proveedores. Agrega el primero con “Nuevo proveedor”.
        </div>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {suppliers?.map((s) => (
          <li
            key={s.id}
            className={`rounded-2xl border border-line bg-white p-4 shadow-sm ${s.isActive ? "" : "opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  {s.name} {!s.isActive && <span className="text-xs font-medium text-ink/50">(inactivo)</span>}
                </p>
                <p className="text-sm text-ink/60">
                  {s.contactName ? `${s.contactName} · ` : ""}
                  {s.productsCount} {s.productsCount === 1 ? "producto" : "productos"}
                  {s.dispatchDays != null && ` · despacha en ${s.dispatchDays} ${s.dispatchDays === 1 ? "día" : "días"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(s)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-deep hover:bg-line/60"
              >
                <Pencil className="size-3.5" />
                Editar
              </button>
            </div>
            <a
              href={`https://wa.me/58${s.whatsapp.replace(/^0/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-deep hover:underline"
            >
              <MessageCircle className="size-4" />
              {s.whatsapp}
            </a>
            {s.notes && <p className="mt-2 whitespace-pre-line text-sm text-ink/60">{s.notes}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SupplierForm({
  supplier,
  onSaved,
  onCancel,
  onApiError,
}: {
  supplier: Supplier | null;
  onSaved: () => void;
  onCancel: () => void;
  onApiError: (err: unknown) => void;
}) {
  const [values, setValues] = useState<SupplierInput>(
    supplier
      ? {
          name: supplier.name,
          whatsapp: supplier.whatsapp,
          contactName: supplier.contactName,
          notes: supplier.notes,
          dispatchDays: supplier.dispatchDays,
          isActive: supplier.isActive,
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof SupplierInput>(field: K, value: SupplierInput[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const data: SupplierInput = {
      ...values,
      name: values.name.trim(),
      contactName: values.contactName?.trim() || null,
      notes: values.notes?.trim() || null,
    };
    try {
      if (supplier) await adminApi.updateSupplier(supplier.id, data);
      else await adminApi.createSupplier(data);
      onSaved();
    } catch (err) {
      onApiError(err);
      if (err instanceof SessionApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError("No se pudo guardar.");
      }
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-4 space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm"
    >
      <h3 className="text-lg font-bold">{supplier ? "Editar proveedor" : "Nuevo proveedor"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="supplier-name" label="Nombre" error={errors.name}>
          <input
            id="supplier-name"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={120}
            className={inputClass(Boolean(errors.name))}
          />
        </Field>
        <Field id="supplier-whatsapp" label="WhatsApp" error={errors.whatsapp}>
          <input
            id="supplier-whatsapp"
            type="tel"
            inputMode="tel"
            value={values.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            placeholder="0414 1234567"
            className={inputClass(Boolean(errors.whatsapp))}
          />
        </Field>
        <Field id="supplier-contact" label="Persona de contacto (opcional)" error={errors.contactName}>
          <input
            id="supplier-contact"
            value={values.contactName ?? ""}
            onChange={(e) => set("contactName", e.target.value)}
            maxLength={120}
            className={inputClass(Boolean(errors.contactName))}
          />
        </Field>
        <Field
          id="supplier-days"
          label="Días que tarda en despachar (opcional)"
          error={errors.dispatchDays}
        >
          <input
            id="supplier-days"
            inputMode="numeric"
            value={values.dispatchDays ?? ""}
            onChange={(e) => {
              const n = e.target.value.replace(/\D/g, "");
              set("dispatchDays", n === "" ? null : Number(n));
            }}
            className={inputClass(Boolean(errors.dispatchDays))}
          />
        </Field>
      </div>
      <Field id="supplier-notes" label="Notas (opcional)" error={errors.notes} hint="Ej: horario, forma de pago, mínimo de compra">
        <textarea
          id="supplier-notes"
          rows={3}
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={2000}
          className={inputClass(Boolean(errors.notes))}
        />
      </Field>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="size-4 accent-brand"
        />
        <span className="text-sm font-medium">Activo</span>
      </label>
      <FormError message={formError} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </button>
      </div>
    </form>
  );
}
