"use client";
// SellersAdmin: vendedores por estado. Antes de aprobar conviene escribirle por WhatsApp
// y confirmar que los datos de Pago Móvil son suyos.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import type { AdminSeller, SellerStatus } from "@/lib/api/types";
import { secondaryButton } from "@/components/ui/form";

const TABS: { status: SellerStatus; label: string }[] = [
  { status: "PENDING", label: "Por aprobar" },
  { status: "ACTIVE", label: "Activos" },
  { status: "SUSPENDED", label: "Suspendidos" },
];

const dateFormatter = new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" });

export default function SellersAdmin({ onApiError }: { onApiError: (err: unknown) => void }) {
  const [tab, setTab] = useState<SellerStatus>("PENDING");
  const [all, setAll] = useState<AdminSeller[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAll(await adminApi.sellers());
      setError(null);
    } catch (err) {
      onApiError(err);
      setError("No se pudieron cargar los vendedores.");
    }
  }, [onApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (seller: AdminSeller, status: SellerStatus, note?: string) => {
    try {
      const updated = await adminApi.updateSellerStatus(seller.id, status, note);
      setAll((list) => list?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
    } catch (err) {
      onApiError(err);
      throw err;
    }
  };

  const visible = all?.filter((s) => s.status === tab) ?? null;

  return (
    <section>
      <nav aria-label="Estados de los vendedores" className="flex gap-2">
        {TABS.map(({ status, label }) => {
          const count = all?.filter((s) => s.status === status).length ?? 0;
          const active = status === tab;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setTab(status)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-deep text-white" : "border border-line bg-white text-ink/70 hover:bg-line/50"
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  status === "PENDING" && count > 0 ? "bg-brand text-white" : active ? "bg-white/20" : "bg-line"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {error && <p className="mt-4 text-sm text-brand-dark">{error}</p>}

      <div className="mt-4 space-y-3">
        {visible === null ? (
          <div className="h-32 animate-pulse rounded-2xl bg-line/50" />
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-12 text-center text-ink/50">
            No hay vendedores aquí.
          </p>
        ) : (
          visible.map((s) => <SellerCard key={s.id} seller={s} onUpdate={update} />)
        )}
      </div>
    </section>
  );
}

function SellerCard({
  seller,
  onUpdate,
}: {
  seller: AdminSeller;
  onUpdate: (seller: AdminSeller, status: SellerStatus, note?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (status: SellerStatus, why?: string) => {
    setBusy(true);
    setError(null);
    try {
      await onUpdate(seller, status, why);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
      setBusy(false);
    }
  };

  const submitSuspend = (e: FormEvent) => {
    e.preventDefault();
    void run("SUSPENDED", note.trim() || undefined);
  };

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{seller.storeName}</h3>
          <p className="text-sm text-ink/60">
            {seller.email ?? "Sin cuenta asignada"} · desde {dateFormatter.format(new Date(seller.createdAt))} ·{" "}
            {seller.productsCount} {seller.productsCount === 1 ? "producto" : "productos"}
          </p>
        </div>
        <a
          href={`https://wa.me/58${seller.whatsapp.replace(/^0/, "")}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-deep hover:underline"
        >
          <MessageCircle className="size-4" />
          {seller.whatsapp}
        </a>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-cream p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink/50">Banco</dt>
          <dd className="font-medium">{seller.pagoMovilBank}</dd>
        </div>
        <div>
          <dt className="text-ink/50">Teléfono Pago Móvil</dt>
          <dd className="font-medium tabular-nums">{seller.pagoMovilPhone}</dd>
        </div>
        <div>
          <dt className="text-ink/50">Cédula / RIF</dt>
          <dd className="font-medium">{seller.pagoMovilId}</dd>
        </div>
      </dl>

      {seller.status === "SUSPENDED" && seller.statusNote && (
        <p className="mt-2 text-sm text-ink/60">Motivo: {seller.statusNote}</p>
      )}

      <footer className="mt-4 border-t border-line pt-4">
        {suspending ? (
          <form onSubmit={submitSuspend} className="flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              autoFocus
              placeholder="Motivo (lo verá el vendedor)"
              aria-label="Motivo de la suspensión"
              className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
            <button type="submit" disabled={busy} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Suspender
            </button>
            <button type="button" onClick={() => setSuspending(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-ink/60 hover:bg-line/50">
              Volver
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seller.status !== "ACTIVE" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("ACTIVE")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {seller.status === "PENDING" ? "Aprobar tienda" : "Reactivar"}
              </button>
            )}
            {seller.status !== "SUSPENDED" && (
              <button type="button" disabled={busy} onClick={() => setSuspending(true)} className={secondaryButton}>
                Suspender
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-brand-dark">{error}</p>}
      </footer>
    </article>
  );
}
