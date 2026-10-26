"use client";
// ProductEditor: crear o editar un producto del vendedor, con subida de foto.

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { sellerApi } from "@/lib/api/seller";
import { SessionApiError } from "@/lib/api/session";
import type { SellerProduct, SellerProductInput } from "@/lib/api/types";
import { Field, FormError, inputClass, primaryButton, secondaryButton } from "@/components/ui/form";

interface ProductEditorProps {
  product: SellerProduct | null; // null = nuevo
  onSaved: (product: SellerProduct) => void;
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

const toDraft = (p: SellerProduct | null): Draft => ({
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
      const { url } = await sellerApi.uploadImage(file);
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
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    const data: SellerProductInput = {
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
      onSaved(product ? await sellerApi.updateProduct(product.id, data) : await sellerApi.createProduct(data));
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
