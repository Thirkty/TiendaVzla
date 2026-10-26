"use client";
// RateCard: tasa BCV vigente (con su fecha valor), la próxima ya publicada, alertas si la
// tasa está atrasada o si no se pudo consultar, y opciones para traerla o fijarla a mano.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarClock, Loader2, Pencil, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import type { ExchangeRate, RateStatus } from "@/lib/api/types";

const SOURCE_LABEL: Record<ExchangeRate["source"], string> = {
  bcv: "bcv.org.ve",
  dolarapi: "DolarApi (respaldo)",
  manual: "fijada a mano",
  env: "valor inicial del .env",
};

const dayFormatter = new Intl.DateTimeFormat("es-VE", {
  weekday: "long",
  day: "numeric",
  month: "short",
});
const timeFormatter = new Intl.DateTimeFormat("es-VE", { timeStyle: "short" });

/** "2026-10-27" -> "martes, 27 oct" (fecha local, sin corrimiento por zona horaria). */
function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return dayFormatter.format(new Date(y, m - 1, d));
}

function formatRate(rate: number): string {
  return `${rate.toLocaleString("es-VE", { maximumFractionDigits: 4 })} Bs/$`;
}

export default function RateCard() {
  const [status, setStatus] = useState<RateStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await adminApi.rateStatus());
    } catch {
      setError("No se pudo cargar la tasa");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tasa");
    } finally {
      await loadStatus(); // el estado cambia también si la consulta falló
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
    void run(() => adminApi.setRate(value));
  };

  const current = status?.current;
  const check = status?.lastCheck;

  return (
    <section
      className={`rounded-2xl border bg-white p-5 shadow-sm ${status?.stale ? "border-brand" : "border-line"}`}
    >
      {status?.stale && (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand-dark"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>
            <span className="font-bold">La tasa está vieja:</span> lleva{" "}
            {status.businessDaysBehind} días hábiles sin actualizarse. Revisa bcv.org.ve y, si
            hace falta, fíjala a mano. Los pedidos nuevos se están cobrando con esta tasa.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink/60">Tasa BCV vigente</p>
          <p className="text-3xl font-extrabold tabular-nums">
            {current ? formatRate(current.rate) : "—"}
          </p>
          {current && (
            <p className="mt-1 text-xs text-ink/50">
              Rige desde el {formatDay(current.validFrom)} · {SOURCE_LABEL[current.source]}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => adminApi.refreshRate())}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold transition hover:bg-line/50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Consultar BCV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setDraft(current ? String(current.rate) : "");
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold transition hover:bg-line/50"
          >
            <Pencil className="size-4" />
            Fijar a mano
          </button>
        </div>
      </div>

      {status?.upcoming && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm">
          <CalendarClock className="size-4 shrink-0 text-deep" />
          <span>
            Desde el <span className="font-semibold">{formatDay(status.upcoming.validFrom)}</span>:{" "}
            <span className="font-bold tabular-nums">{formatRate(status.upcoming.rate)}</span>
            <span className="text-ink/50"> · ya publicada, se aplica sola a las 00:00</span>
          </span>
        </p>
      )}

      {check && (
        <p className={`mt-3 text-xs ${check.ok ? "text-ink/50" : "font-medium text-brand-dark"}`}>
          Última consulta {timeFormatter.format(new Date(check.at))}:{" "}
          {check.ok
            ? check.source === "bcv"
              ? "bcv.org.ve respondió bien."
              : "el sitio del BCV no respondió; se usó DolarApi de respaldo."
            : `no se pudo consultar (${check.error}). Se mantiene la última tasa guardada.`}
        </p>
      )}

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
            Rige desde hoy para los pedidos nuevos, hasta que empiece la próxima tasa del BCV. Para volver a la oficial, pulsa “Consultar BCV”.
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
