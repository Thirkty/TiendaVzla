"use client";
// ProductEditor: crear o editar un producto de la tienda, con subida de foto.

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { SessionApiError } from "@/lib/api/session";
import type { AdminProduct, OfferInput, ProductInput, Supplier } from "@/lib/api/types";
import { formatUsd } from "@/lib/utils/format";
import { Field, FormError, inputClass, primaryButton, secondaryButton } from "@/components/ui/form";

interface ProductEditorProps {
  product: AdminProduct | null; // null = nuevo
  onSaved: (product: AdminProduct) => void;
  onClose: () => void;
}

interface Draft {
  name: string;
  description: string;
  priceUsd: string;
  originalPriceUsd: string;
  shippingCostUsd: string;
  stock: string;
  imageUrl: string;
  category: string;
  badge: string;
  isActive: boolean;
}

const toDraft = (p: AdminProduct | null): Draft => ({
  name: p?.name ?? "",
  description: p?.description ?? "",
  priceUsd: p ? String(p.priceUsd) : "",
  originalPriceUsd: p?.originalPriceUsd ? String(p.originalPriceUsd) : "",
  shippingCostUsd: p ? String(p.shippingCostUsd) : "0",
  stock: p ? String(p.stock) : "",
  imageUrl: p?.imageUrl ?? "",
  category: p?.category ?? "",
  badge: p?.badge ?? "",
  isActive: p?.isActive ?? true,
});

/** "12,50" o "12.50" -> 12.5 ; vacío o inválido -> NaN */
const parseAmount = (value: string) => (value.trim() ? Number(value.replace(",", ".")) : NaN);

export default function ProductEditor({ product, onSaved, onClose }: ProductEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(product));
  const [offers, setOffers] = useState<OfferRow[]>(() => toOfferRows(product));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    adminApi.suppliers().then(setSuppliers).catch(() => undefined);
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setErrors((e) => ({ ...e, imageUrl: "" }));
    try {
      const { url } = await adminApi.uploadImage(file);
      set("imageUrl", url);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        imageUrl: err instanceof SessionApiError ? err.message : "No se pudo subir la imagen",
      }));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const price = parseAmount(draft.priceUsd);
    const original = parseAmount(draft.originalPriceUsd);
    const shipping = parseAmount(draft.shippingCostUsd || "0");
    const stock = Number(draft.stock);

    const found: Record<string, string> = {};
    if (draft.name.trim().length < 3) found.name = "Escribe el nombre del producto";
    if (!(price > 0)) found.priceUsd = "Precio mayor que 0";
    if (draft.originalPriceUsd && !(original > price)) found.originalPriceUsd = "Debe ser mayor que el precio";
    if (!(shipping >= 0)) found.shippingCostUsd = "Usa 0 si el envío es gratis";
    if (!Number.isInteger(stock) || stock < 0 || draft.stock === "") found.stock = "Número entero, 0 o más";
    if (!draft.imageUrl) found.imageUrl = "Sube una foto del producto";
    const offerInputs = toOfferInputs(offers);
    if (offerInputs === null) found.offers = "Cada proveedor necesita un costo válido (0 o más)";
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    const data: ProductInput = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      priceUsd: price,
      originalPriceUsd: draft.originalPriceUsd ? original : null,
      shippingCostUsd: shipping,
      stock,
      imageUrl: draft.imageUrl,
      category: draft.category.trim() || null,
      badge: draft.badge.trim() || null,
      isActive: draft.isActive,
    };

    setSaving(true);
    setFormError(null);
    try {
      const savedProduct = product
        ? await adminApi.updateProduct(product.id, data)
        : await adminApi.createProduct(data);
      // Los proveedores se guardan aparte, una vez que el producto existe.
      onSaved(await adminApi.setProductOffers(savedProduct.id, offerInputs ?? []));
    } catch (err) {
      if (err instanceof SessionApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError("No se pudo guardar. Intenta de nuevo.");
      }
      setSaving(false);
    }
  };

  const text = (field: keyof Draft, props: Record<string, unknown> = {}) => ({
    id: field,
    value: draft[field] as string,
    onChange: (e: { target: { value: string } }) => set(field, e.target.value as never),
    "aria-invalid": Boolean(errors[field]),
    className: inputClass(Boolean(errors[field])),
    ...props,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-label={product ? "Editar producto" : "Nuevo producto"}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-cream p-6 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{product ? "Editar producto" : "Nuevo producto"}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 hover:bg-line">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr]">
          {/* Foto */}
          <div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-dashed border-line bg-white">
              {draft.imageUrl ? (
                <Image src={draft.imageUrl} alt="" fill sizes="180px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-ink/30">
                  <ImagePlus className="size-10" />
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className={`${secondaryButton} mt-2 w-full`}
            >
              <ImagePlus className="size-4" />
              {draft.imageUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            {errors.imageUrl ? (
              <p className="mt-1.5 text-sm text-brand-dark">{errors.imageUrl}</p>
            ) : (
              <p className="mt-1.5 text-xs text-ink/50">JPG, PNG o WebP, hasta 5 MB.</p>
            )}
          </div>

          {/* Datos */}
          <div className="space-y-4">
            <Field id="name" label="Nombre" error={errors.name}>
              <input {...text("name", { maxLength: 200 })} />
            </Field>
            <Field id="description" label="Descripción" error={errors.description}>
              <textarea {...text("description", { rows: 4, maxLength: 5000 })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="priceUsd" label="Precio (USD)" error={errors.priceUsd}>
                <input {...text("priceUsd", { inputMode: "decimal", placeholder: "25.00" })} />
              </Field>
              <Field
                id="originalPriceUsd"
                label="Precio antes (opcional)"
                error={errors.originalPriceUsd}
                hint="Se muestra tachado"
              >
                <input {...text("originalPriceUsd", { inputMode: "decimal" })} />
              </Field>
              <Field id="shippingCostUsd" label="Envío (USD)" error={errors.shippingCostUsd} hint="0 = gratis">
                <input {...text("shippingCostUsd", { inputMode: "decimal" })} />
              </Field>
              <Field id="stock" label="Disponibles" error={errors.stock}>
                <input {...text("stock", { inputMode: "numeric" })} />
              </Field>
              <Field id="category" label="Categoría (opcional)" error={errors.category}>
                <input {...text("category", { maxLength: 80, placeholder: "Hogar" })} />
              </Field>
              <Field id="badge" label="Etiqueta (opcional)" error={errors.badge}>
                <input {...text("badge", { maxLength: 40, placeholder: "Nuevo" })} />
              </Field>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="size-4 accent-brand"
              />
              <span className="text-sm font-medium">Publicado (visible en la tienda)</span>
            </label>
          </div>
        </div>

        <OffersEditor
          offers={offers}
          suppliers={suppliers}
          price={parseAmount(draft.priceUsd)}
          error={errors.offers}
          onChange={(rows) => {
            setOffers(rows);
            setErrors((e) => ({ ...e, offers: "" }));
          }}
        />

        <div className="mt-6 space-y-3">
          <FormError message={formError} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploading} className={primaryButton}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {product ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- Proveedores y costo ---------- */

interface OfferRow {
  supplierId: string;
  cost: string;
  sku: string;
  isPreferred: boolean;
}

const toOfferRows = (p: AdminProduct | null): OfferRow[] =>
  (p?.offers ?? []).map((o) => ({
    supplierId: o.supplier.id,
    cost: String(o.costUsd),
    sku: o.supplierSku ?? "",
    isPreferred: o.isPreferred,
  }));

/** Filas válidas para la API, o null si alguna tiene un costo inválido. Ignora filas sin proveedor. */
function toOfferInputs(rows: OfferRow[]): OfferInput[] | null {
  const inputs: OfferInput[] = [];
  for (const row of rows) {
    if (!row.supplierId) continue;
    const cost = parseAmount(row.cost);
    if (!(cost >= 0)) return null;
    inputs.push({
      supplierId: row.supplierId,
      costUsd: cost,
      supplierSku: row.sku.trim() || null,
      isPreferred: row.isPreferred,
    });
  }
  return inputs;
}

function OffersEditor({
  offers,
  suppliers,
  price,
  error,
  onChange,
}: {
  offers: OfferRow[];
  suppliers: Supplier[];
  price: number;
  error?: string;
  onChange: (rows: OfferRow[]) => void;
}) {
  const update = (i: number, patch: Partial<OfferRow>) =>
    onChange(offers.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const prefer = (i: number) => onChange(offers.map((row, j) => ({ ...row, isPreferred: j === i })));

  // Margen con el preferido (o el más barato), igual que lo calcula el backend.
  const valid = offers
    .map((o) => ({ ...o, value: parseAmount(o.cost) }))
    .filter((o) => o.supplierId && o.value >= 0);
  const chosen = valid.find((o) => o.isPreferred) ?? [...valid].sort((a, b) => a.value - b.value)[0];
  const margin = chosen && price > 0 ? price - chosen.value : null;

  const used = new Set(offers.map((o) => o.supplierId));
  const activeCount = suppliers.filter((s) => s.isActive).length;

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Proveedores y costo</h3>
        {chosen && margin !== null && (
          <p className={`text-sm font-semibold ${margin >= 0 ? "text-deep" : "text-brand-dark"}`}>
            Costo {formatUsd(chosen.value)} · ganas {formatUsd(margin)} por unidad (
            {Math.round((margin / price) * 100)}%)
          </p>
        )}
      </div>

      {suppliers.length === 0 ? (
        <p className="mt-2 text-sm text-ink/60">
          Primero agrega tus proveedores en la sección “Proveedores” del panel.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {offers.map((row, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={row.supplierId}
                  onChange={(e) => update(i, { supplierId: e.target.value })}
                  aria-label="Proveedor"
                  className="min-w-40 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm"
                >
                  <option value="">Proveedor…</option>
                  {suppliers
                    .filter((s) => s.id === row.supplierId || (s.isActive && !used.has(s.id)))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <input
                  value={row.cost}
                  onChange={(e) => update(i, { cost: e.target.value })}
                  inputMode="decimal"
                  placeholder="Costo USD"
                  aria-label="Costo en USD"
                  className="w-28 rounded-xl border border-line px-3 py-2 text-sm tabular-nums"
                />
                <input
                  value={row.sku}
                  onChange={(e) => update(i, { sku: e.target.value })}
                  maxLength={80}
                  placeholder="Código (opcional)"
                  aria-label="Código del proveedor"
                  className="w-36 rounded-xl border border-line px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => prefer(i)}
                  aria-pressed={row.isPreferred}
                  title="Proveedor preferido: a este se le pide y su costo da el margen"
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold ${
                    row.isPreferred ? "bg-brand/15 text-brand-dark" : "text-ink/50 hover:bg-line/60"
                  }`}
                >
                  <Star className={`size-3.5 ${row.isPreferred ? "fill-current" : ""}`} />
                  Preferido
                </button>
                <button
                  type="button"
                  onClick={() => onChange(offers.filter((_, j) => j !== i))}
                  aria-label="Quitar proveedor"
                  className="rounded-lg p-2 text-ink/40 hover:bg-brand/10 hover:text-brand"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          {offers.length < activeCount && (
            <button
              type="button"
              onClick={() =>
                onChange([...offers, { supplierId: "", cost: "", sku: "", isPreferred: offers.length === 0 }])
              }
              className={`${secondaryButton} mt-3`}
            >
              <Plus className="size-4" />
              Agregar proveedor
            </button>
          )}
        </>
      )}
      {error && <p className="mt-2 text-sm text-brand-dark">{error}</p>}
    </section>
  );
}
