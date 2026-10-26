"use client";
// RateCard: tasa BCV vigente, cuándo se actualizó y opciones para traer la oficial o fijarla a mano.

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { getRate } from "@/lib/api/client";
import type { ExchangeRate } from "@/lib/api/types";

const SOURCE_LABEL: Record<ExchangeRate["source"], string> = {
  bcv: "Oficial BCV (automática)",
  manual: "Fijada a mano",
  env: "Valor inicial del .env",
};

const dateFormatter = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function RateCard({ adminKey }: { adminKey: string }) {
  const [rate, setRate] = useState<ExchangeRate | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getRate().then(setRate);
  }, []);

  const run = async (action: () => Promise<ExchangeRate>) => {
    setBusy(true);
    setError(null);
    try {
      setRate(await action());
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tasa");
    } finally {
      setBusy(false);
    }
  };

  const saveManual = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(draft.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Escribe una tasa válida, por ejemplo 886,23");
      return;
    }
    void run(() => adminApi.setRate(adminKey, value));
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink/60">Tasa BCV vigente</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {rate ? `${rate.rate.toLocaleString("es-VE", { maximumFractionDigits: 4 })} Bs/$` : "—"}
          </p>
          {rate && (
            <p className="mt-1 text-xs text-ink/50">
              {SOURCE_LABEL[rate.source]}
              {rate.sourceDate && ` · publicada ${dateFormatter.format(new Date(rate.sourceDate))}`}
              {` · registrada ${dateFormatter.format(new Date(rate.updatedAt))}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => adminApi.refreshRate(adminKey))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold transition hover:bg-line/50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Traer del BCV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setDraft(rate ? String(rate.rate) : "");
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold transition hover:bg-line/50"
          >
            <Pencil className="size-4" />
            Fijar a mano
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveManual} className="mt-4 flex flex-wrap gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="decimal"
            aria-label="Nueva tasa en Bs por dólar"
            placeholder="886,23"
            className="w-40 rounded-xl border border-line px-3 py-2 tabular-nums outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-deep px-4 py-2 text-sm font-semibold text-white transition hover:bg-deep/90 disabled:opacity-50"
          >
            Guardar
          </button>
          <p className="w-full text-xs text-ink/50">
            Se usa en los pedidos nuevos hasta la próxima actualización automática (cada pocas horas).
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-dark">
          {error}
        </p>
      )}
    </section>
  );
}
