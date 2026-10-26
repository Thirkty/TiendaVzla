"use client";
// PagoMovilStep: un pago por vendedor. Cada tarjeta muestra el monto exacto en Bs. y el
// Pago Móvil de ESE vendedor, y envía su referencia con POST /api/orders/{id}/pay.
// Cada vendedor verifica su pago en su banco. Arriba se ve cuánto tiempo queda para pagar.

import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Check, CircleCheck, Clock, Copy, Loader2, Smartphone } from "lucide-react";
import { ApiError, confirmPayment } from "@/lib/api/client";
import type { Order } from "@/lib/api/types";
import { formatBs, formatUsd } from "@/lib/utils/format";
import { isValidReference } from "@/lib/utils/validation";

interface PagoMovilStepProps {
  orders: Order[];
  onUpdated: (order: Order) => void;
  /** Las órdenes vencieron: el padre limpia el estado y vuelve a la tienda. */
  onExpired: () => void;
}

export default function PagoMovilStep({ orders, onUpdated, onExpired }: PagoMovilStepProps) {
  const pending = orders.filter((o) => o.status === "PENDING");
  const deadline = pending.map((o) => o.expiresAt).filter(Boolean).sort()[0] ?? null;
  const remaining = useCountdown(deadline);
  const totalVes = orders.reduce((sum, o) => sum + o.totalVes, 0);

  if (remaining === 0 && pending.length > 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <Clock className="mx-auto size-12 text-brand" strokeWidth={1.5} />
        <h2 className="mt-3 text-xl font-bold">Se acabó el tiempo para pagar</h2>
        <p className="mt-2 text-ink/60">
          Liberamos los productos que no se pagaron. Si ya hiciste un Pago Móvil, escríbele al
          vendedor por WhatsApp con la referencia.
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-deep p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
          <Smartphone className="size-4" />
          {orders.length > 1
            ? `Total de tu compra · ${orders.length} pagos, uno por vendedor`
            : "Monto a pagar por Pago Móvil"}
        </div>
        <p className="mt-2 text-4xl font-extrabold tabular-nums">{formatBs(totalVes)}</p>
        {orders.length > 1 && (
          <p className="mt-1 text-sm text-white/60">
            Cada vendedor recibe su pago directo; haz un Pago Móvil a cada uno.
          </p>
        )}
        {remaining !== null && pending.length > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
            <Clock className="size-4 shrink-0" />
            Tus productos están apartados por{" "}
            <span className="font-bold tabular-nums">{formatRemaining(remaining)}</span>
          </p>
        )}
      </div>

      {orders.map((order, i) => (
        <SellerPaymentCard
          key={order.id}
          order={order}
          step={orders.length > 1 ? `Pago ${i + 1} de ${orders.length}` : null}
          onUpdated={onUpdated}
        />
      ))}

      <p className="text-center text-xs text-ink/50">
        Cada vendedor verifica su pago en el banco antes de despachar.
      </p>
    </div>
  );
}

function SellerPaymentCard({
  order,
  step,
  onUpdated,
}: {
  order: Order;
  step: string | null;
  onUpdated: (order: Order) => void;
}) {
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { seller } = order;
  const inputId = `reference-${order.id}`;

  // Monto sin símbolo ni separador de miles: es lo que se escribe en la app del banco.
  const amountToCopy = order.totalVes.toFixed(2).replace(".", ",");
  const rows = [
    { label: "Banco", value: seller.pagoMovilBank },
    { label: "Teléfono", value: seller.pagoMovilPhone, copy: seller.pagoMovilPhone },
    { label: "Cédula / RIF", value: seller.pagoMovilId, copy: seller.pagoMovilId },
  ];

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
      onUpdated(await confirmPayment(order.id, cleaned));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Algo salió mal. Intenta de nuevo.");
      setSubmitting(false);
    }
  };

  const submitted = order.status !== "PENDING";

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          {step && <p className="text-xs font-semibold uppercase tracking-wider text-brand">{step}</p>}
          <h2 className="text-lg font-bold">{seller.storeName}</h2>
          <p className="text-sm text-ink/60">
            {order.items.map((i) => `${i.quantity}× ${i.product.name}`).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            <p className="text-2xl font-extrabold tabular-nums">{formatBs(order.totalVes)}</p>
            {!submitted && <CopyButton text={amountToCopy} label="Copiar monto" />}
          </div>
          <p className="text-xs text-ink/50">
            {formatUsd(order.subtotalUsd)} +{" "}
            {order.shippingUsd > 0 ? `${formatUsd(order.shippingUsd)} envío` : "envío gratis"} · tasa{" "}
            {order.bcvRate.toLocaleString("es-VE")}
          </p>
        </div>
      </header>

      {submitted ? (
        <p className="flex items-center gap-2 bg-success/10 px-5 py-4 text-sm font-medium text-deep">
          <CircleCheck className="size-5 text-success" />
          Referencia {order.paymentReference} enviada. {seller.storeName} la está verificando.
        </p>
      ) : (
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <dl className="divide-y divide-line rounded-xl bg-cream px-4">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm text-ink/60">{row.label}</dt>
                <dd className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                  {row.value}
                  {row.copy && <CopyButton text={row.copy} label={`Copiar ${row.label}`} />}
                </dd>
              </div>
            ))}
          </dl>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor={inputId} className="block font-bold">
              ¿Ya pagaste? Escribe la referencia
            </label>
            <input
              id={inputId}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              inputMode="numeric"
              maxLength={12}
              placeholder="Ej: 004512"
              aria-invalid={Boolean(error)}
              className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-lg tracking-widest outline-none transition placeholder:tracking-normal placeholder:text-ink/35 focus:border-brand focus:ring-4 focus:ring-brand/15 ${error ? "border-brand" : "border-line"}`}
            />
            {error && (
              <p role="alert" className="mt-1.5 text-sm text-brand-dark">
                {error}
              </p>
            )}
            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.98 }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-70"
            >
              {submitting && <Loader2 className="size-5 animate-spin" />}
              {submitting ? "Enviando…" : "Ya pagué, enviar referencia"}
            </motion.button>
          </form>
        </div>
      )}
    </section>
  );
}

/** Milisegundos que faltan para `deadline` (se actualiza cada segundo); null si no hay límite. */
function useCountdown(deadline: string | null): number | null {
  const target = deadline ? new Date(deadline).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(() =>
    target === null ? null : Math.max(0, target - Date.now()),
  );

  useEffect(() => {
    if (target === null) {
      setRemaining(null);
      return;
    }
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

function CopyButton({ text, label }: { text: string; label: string }) {
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
      className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-line hover:text-ink"
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </button>
  );
}
