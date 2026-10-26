"use client";
// PagoMovilStep: muestra los datos del Pago Móvil y el monto exacto en Bs.,
// muestra cuánto tiempo queda para pagar y envía la referencia con POST /api/orders/{id}/pay.
// El pago queda "en verificación" hasta que el admin lo confirma en el banco.

import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Copy, Loader2, Smartphone } from "lucide-react";
import { ApiError, confirmPayment } from "@/lib/api/client";
import type { Order } from "@/lib/api/types";
import { PAGO_MOVIL } from "@/lib/payment";
import { formatBs, formatUsd } from "@/lib/utils/format";
import { isValidReference } from "@/lib/utils/validation";

interface PagoMovilStepProps {
  order: Order;
  onPaid: (order: Order) => void;
  /** La orden venció: el padre limpia el estado y vuelve al formulario. */
  onExpired: () => void;
}

export default function PagoMovilStep({ order, onPaid, onExpired }: PagoMovilStepProps) {
  const remaining = useCountdown(order.expiresAt);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Monto sin símbolo ni separador de miles: es lo que se escribe en la app del banco.
  const amountToCopy = order.totalVes.toFixed(2).replace(".", ",");

  const rows = [
    { label: "Banco", value: PAGO_MOVIL.bank },
    { label: "Teléfono", value: PAGO_MOVIL.phone, copy: PAGO_MOVIL.phone.replace(/\D/g, "") },
    { label: "Cédula / RIF", value: PAGO_MOVIL.idNumber, copy: PAGO_MOVIL.idNumber },
  ];

  if (remaining === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <Clock className="mx-auto size-12 text-brand" strokeWidth={1.5} />
        <h2 className="mt-3 text-xl font-bold">Se acabó el tiempo para pagar</h2>
        <p className="mt-2 text-ink/60">
          Liberamos los productos de este pedido. Si ya hiciste el Pago Móvil, escríbenos por
          WhatsApp con la referencia y lo resolvemos.
        </p>
        <button
          type="button"
          onClick={onExpired}
          className="mt-6 rounded-2xl bg-brand px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          Volver a la tienda
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = reference.trim();
    if (!isValidReference(cleaned)) {
      setError("La referencia son los 4 a 12 dígitos que te da el banco");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      onPaid(await confirmPayment(order.id, cleaned));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo salió mal. Intenta de nuevo.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-deep p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
          <Smartphone className="size-4" />
          Monto a pagar por Pago Móvil
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <p className="text-4xl font-extrabold tabular-nums">{formatBs(order.totalVes)}</p>
          <CopyButton text={amountToCopy} label="Copiar monto" dark />
        </div>
        <p className="mt-2 text-sm text-white/60">
          {formatUsd(order.totalUsd)} a tasa BCV {order.bcvRate.toLocaleString("es-VE")} Bs/$
        </p>
        {remaining !== null && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
            <Clock className="size-4 shrink-0" />
            Tus productos están apartados por{" "}
            <span className="font-bold tabular-nums">{formatRemaining(remaining)}</span>
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Datos para el Pago Móvil</h2>
        <dl className="mt-3 divide-y divide-line">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sm text-ink/60">{row.label}</dt>
              <dd className="flex items-center gap-2 font-semibold tabular-nums">
                {row.value}
                {row.copy && <CopyButton text={row.copy} label={`Copiar ${row.label}`} />}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-2xl border border-line bg-white p-5 shadow-sm"
      >
        <label htmlFor="reference" className="block text-lg font-bold">
          ¿Ya pagaste? Escribe la referencia
        </label>
        <p className="mt-1 text-sm text-ink/60">
          Son los últimos dígitos del comprobante que te muestra tu banco.
        </p>
        <input
          id="reference"
          value={reference}
          onChange={(e) => {
            setReference(e.target.value.replace(/\D/g, ""));
            setError(null);
          }}
          inputMode="numeric"
          maxLength={12}
          placeholder="Ej: 004512"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "reference-error" : undefined}
          className={`mt-4 w-full rounded-xl border bg-white px-4 py-3 text-lg tracking-widest outline-none transition placeholder:tracking-normal placeholder:text-ink/35 focus:border-brand focus:ring-4 focus:ring-brand/15 ${error ? "border-brand" : "border-line"}`}
        />
        {error && (
          <p id="reference-error" role="alert" className="mt-1.5 text-sm text-brand-dark">
            {error}
          </p>
        )}

        <motion.button
          type="submit"
          disabled={submitting}
          whileTap={{ scale: 0.98 }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-brand-dark hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
        >
          {submitting && <Loader2 className="size-5 animate-spin" />}
          {submitting ? "Enviando…" : "Ya pagué, enviar referencia"}
        </motion.button>
      </form>

      <p className="text-center text-xs text-ink/50">
        Pedido #{order.id.slice(0, 8).toUpperCase()} · Verificamos cada pago en el banco antes de
        despachar.
      </p>
    </div>
  );
}

/** Milisegundos que faltan para `deadline` (se actualiza cada segundo); null si no hay límite. */
function useCountdown(deadline: string | null): number | null {
  const target = deadline ? new Date(deadline).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(() =>
    target === null ? null : Math.max(0, target - Date.now()),
  );

  useEffect(() => {
    if (target === null) return;
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

function CopyButton({ text, label, dark = false }: { text: string; label: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso de portapapeles: el dato igual está visible para copiarlo a mano.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`rounded-lg p-1.5 transition-colors ${dark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-ink/40 hover:bg-line hover:text-ink"}`}
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </button>
  );
}
