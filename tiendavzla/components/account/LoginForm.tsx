"use client";
// LoginForm: entrada al panel de admin. Si ya hay sesión, redirige al panel.

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { accountApi, homeFor, SessionApiError } from "@/lib/api/session";
import { Field, FormError, inputClass, primaryButton } from "@/components/ui/form";

/** Solo se aceptan rutas internas en ?next= (evita redirigir a otro sitio). */
function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void accountApi.me().then((me) => {
      if (me) router.replace(next ?? homeFor(me));
    }).catch(() => undefined);
  }, [router, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const me = await accountApi.login(email.trim(), password);
      router.replace(next ?? homeFor(me));
    } catch (err) {
      setError(err instanceof SessionApiError ? err.message : "No se pudo iniciar sesión");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Entrar</h1>
      <p className="mt-1 text-ink/60">Panel de administración de TiendaVzla.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field id="email" label="Correo">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={inputClass()}
          />
        </Field>
        <Field id="password" label="Contraseña">
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={inputClass()}
          />
        </Field>
        <FormError message={error} />
        <button type="submit" disabled={submitting} className={`${primaryButton} w-full`}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Entrar
        </button>
      </form>

    </div>
  );
}
