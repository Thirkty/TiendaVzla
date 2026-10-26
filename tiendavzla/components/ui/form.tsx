// Piezas de formulario compartidas por login, registro y paneles.
import type { ReactNode } from "react";

export const inputClass = (hasError = false) =>
  `w-full rounded-xl border bg-white px-4 py-3 text-base outline-none transition placeholder:text-ink/35 focus:border-brand focus:ring-4 focus:ring-brand/15 ${
    hasError ? "border-brand" : "border-line"
  }`;

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold transition hover:bg-line/50 disabled:opacity-50";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink/80">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-brand-dark">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink/50">{hint}</p>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-brand/10 px-4 py-3 text-sm font-medium text-brand-dark">
      {message}
    </p>
  );
}
