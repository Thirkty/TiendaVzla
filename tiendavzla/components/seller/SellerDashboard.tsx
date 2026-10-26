"use client";
// SellerDashboard: panel del vendedor. Estado de la tienda (en revisión / activa /
// suspendida), sus pedidos, sus productos y los datos de la tienda (WhatsApp y Pago Móvil).

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Clock, EyeOff, Loader2, Pencil, Plus } from "lucide-react";
import { sellerApi } from "@/lib/api/seller";
import { SessionApiError } from "@/lib/api/session";
import type { SellerProduct, SellerProfile, SellerProfileInput } from "@/lib/api/types";
import { formatUsd } from "@/lib/utils/format";
import { FormError, primaryButton } from "@/components/ui/form";
import StoreProfileFields from "@/components/account/StoreProfileFields";
import PanelHeader from "@/components/panel/PanelHeader";
import { useRequireSession } from "@/components/panel/useRequireSession";
import ProductEditor from "./ProductEditor";
import SellerOrders from "./SellerOrders";

type Tab = "orders" | "products" | "store";

export default function SellerDashboard() {
  const { me, error, reload, logout } = useRequireSession();
  const [tab, setTab] = useState<Tab>("orders");

  if (error) return <p className="p-8 text-center text-brand-dark">{error}</p>;
  if (!me) return <div className="mx-auto mt-16 h-64 max-w-4xl animate-pulse rounded-2xl bg-line/50" />;
  if (!me.seller) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-lg font-bold">Esta cuenta no tiene tienda.</p>
        <Link href="/vender" className={`${primaryButton} mt-4`}>
          Abrir una tienda
        </Link>
      </div>
    );
  }

  const seller = me.seller;
  return (
    <>
      <PanelHeader me={me} current="vendedor" onLogout={logout} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Mi tienda</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{seller.storeName}</h1>

        <StatusBanner seller={seller} />

        <nav className="mt-6 flex gap-2" aria-label="Secciones">
          {(
            [
              ["orders", "Pedidos"],
              ["products", "Productos"],
              ["store", "Datos de la tienda"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === key ? "bg-deep text-white" : "border border-line bg-white text-ink/70 hover:bg-line/50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "orders" ? (
            <SellerOrders />
          ) : tab === "products" ? (
            <ProductsTab readOnly={seller.status === "SUSPENDED"} />
          ) : (
            <StoreTab seller={seller} readOnly={seller.status === "SUSPENDED"} onSaved={reload} />
          )}
        </div>
      </div>
    </>
  );
}

function StatusBanner({ seller }: { seller: SellerProfile }) {
  if (seller.status === "ACTIVE") return null;
  const pending = seller.status === "PENDING";
  return (
    <div
      role="status"
      className={`mt-4 flex gap-3 rounded-2xl px-4 py-3 text-sm ${
        pending ? "bg-deep/10 text-deep" : "bg-brand/10 text-brand-dark"
      }`}
    >
      {pending ? <Clock className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
      <p>
        {pending ? (
          <>
            <span className="font-bold">Tu tienda está en revisión.</span> Ya puedes cargar tus
            productos; se mostrarán en TiendaVzla apenas la aprobemos.
          </>
        ) : (
          <>
            <span className="font-bold">Tu tienda está suspendida</span>
            {seller.statusNote && `: ${seller.statusNote}`}. Tus productos no se muestran.
            Escríbenos para revisarlo.
          </>
        )}
      </p>
    </div>
  );
}

function ProductsTab({ readOnly }: { readOnly: boolean }) {
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  const [editing, setEditing] = useState<SellerProduct | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProducts(await sellerApi.products());
    } catch {
      setError("No se pudieron cargar tus productos.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saved = (product: SellerProduct) => {
    setProducts((list = []) =>
      editing === "new"
        ? [product, ...(list ?? [])]
        : (list ?? []).map((p) => (p.id === product.id ? product : p)),
    );
    setEditing(null);
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {products ? `${products.length} ${products.length === 1 ? "producto" : "productos"}` : "Cargando…"}
        </p>
        {!readOnly && (
          <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
            <Plus className="size-4" />
            Nuevo producto
          </button>
        )}
      </div>

      <FormError message={error} />

      {products?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-line py-16 text-center text-ink/60">
          Aún no tienes productos. Crea el primero con “Nuevo producto”.
        </div>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p) => (
          <li key={p.id} className="flex gap-3 rounded-2xl border border-line bg-white p-3 shadow-sm">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-line/50">
              <Image src={p.imageUrl} alt="" fill sizes="80px" className="object-cover" />
              {!p.isActive && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/50 text-white">
                  <EyeOff className="size-5" />
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
              <p className="text-sm tabular-nums">
                {formatUsd(p.priceUsd)}{" "}
                <span className="text-ink/50">
                  · envío {p.shippingCostUsd > 0 ? formatUsd(p.shippingCostUsd) : "gratis"}
                </span>
              </p>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className={`text-xs font-medium ${p.stock === 0 ? "text-brand-dark" : "text-ink/50"}`}>
                  {p.isActive ? (p.stock === 0 ? "Agotado" : `${p.stock} disponibles`) : "Oculto"}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-deep hover:bg-line/60"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function StoreTab({
  seller,
  readOnly,
  onSaved,
}: {
  seller: SellerProfile;
  readOnly: boolean;
  onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState<SellerProfileInput>({
    storeName: seller.storeName,
    whatsapp: seller.whatsapp,
    pagoMovilBank: seller.pagoMovilBank,
    pagoMovilPhone: seller.pagoMovilPhone,
    pagoMovilId: seller.pagoMovilId,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setMessage(null);
    try {
      await sellerApi.updateStore(values);
      await onSaved();
      setMessage("Datos guardados.");
    } catch (err) {
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
      <fieldset disabled={readOnly} className="space-y-4">
        <StoreProfileFields
          values={values}
          errors={errors}
          onChange={(field, value) => {
            setValues((v) => ({ ...v, [field]: value }));
            setErrors((er) => ({ ...er, [field]: "" }));
          }}
        />
      </fieldset>
      <p className="text-xs text-ink/50">
        Enlace de tu tienda: <span className="font-mono">tiendavzla/{seller.slug}</span> (no cambia
        aunque cambies el nombre).
      </p>
      <FormError message={formError} />
      {message && <p className="text-sm font-medium text-deep">{message}</p>}
      {!readOnly && (
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </button>
      )}
    </form>
  );
}
