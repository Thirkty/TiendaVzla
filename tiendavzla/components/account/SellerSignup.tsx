"use client";
// SellerSignup: registro de vendedores. Crea la cuenta y la tienda (queda en revisión)
// y entra directo al panel del vendedor.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  accountApi,
  SessionApiError,
  type SellerRegistration,
} from "@/lib/api/session";
import type { SellerProfileInput } from "@/lib/api/types";
import {
  Field,
  FormError,
  inputClass,
  primaryButton,
} from "@/components/ui/form";
import StoreProfileFields from "./StoreProfileFields";

const EMPTY: SellerRegistration = {
  email: "",
  password: "",
  storeName: "",
  whatsapp: "",
  pagoMovilBank: "",
  pagoMovilPhone: "",
  pagoMovilId: "",
};

// Pasos de "cómo funciona", numerados al estilo editorial de la portada.
const STEPS = [
  {
    title: "Abre tu tienda",
    text: "Te registras en dos minutos. Revisamos tus datos para que los compradores confíen.",
  },
  {
    title: "Publica tus productos",
    text: "Con tu foto, tu precio y tu costo de envío. Los cambias cuando quieras.",
  },
  {
    title: "Cobra directo",
    text: "El cliente te paga a tu Pago Móvil. Tú verificas y despachas desde tu panel.",
  },
] as const;

export default function SellerSignup() {
  const router = useRouter();
  const [values, setValues] = useState<SellerRegistration>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof SellerRegistration, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (values.password.length < 8) found.password = "Mínimo 8 caracteres";
    if (!values.pagoMovilBank) found.pagoMovilBank = "Selecciona tu banco";
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await accountApi.registerSeller({
        ...values,
        email: values.email.trim(),
      });
      router.replace("/vendedor");
    } catch (err) {
      if (err instanceof SessionApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError("No se pudo crear la cuenta. Intenta de nuevo.");
      }
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-mist">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_440px] lg:items-start">
        <div>
          <p className="fade-up text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
            Vende con nosotros
          </p>
          <h1 className="fade-up mt-4 text-[2.4rem] font-bold leading-[1.02] tracking-tight [animation-delay:80ms] sm:text-6xl">
            Vende a toda Venezuela,{" "}
            <span className="whitespace-nowrap font-serif text-[1.12em] font-normal italic tracking-normal text-brand">
              sin complicarte
            </span>
          </h1>
          <p className="fade-up mt-6 max-w-md text-lg leading-relaxed text-ink/65 [animation-delay:160ms]">
            Tú pones el precio y el envío; nosotros te traemos los compradores.
          </p>

          <ol className="fade-up mt-12 divide-y divide-mist-dark border-y border-mist-dark [animation-delay:240ms]">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="grid grid-cols-[3.5rem_1fr] gap-4 py-5"
              >
                <span className="font-serif text-4xl italic leading-none text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-lg font-bold">{step.title}</p>
                  <p className="mt-1 text-ink/60">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 font-serif text-xl text-ink/70">
            Solo cobramos una pequeña comisión{" "}
            <span className="italic">cuando vendes</span>.
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="space-y-4 rounded-3xl bg-white p-6 shadow-[0_20px_50px_-25px_rgba(26,26,26,0.35)] sm:p-8 lg:sticky lg:top-24"
        >
          <h2 className="font-serif text-3xl leading-none">
            Crea tu <span className="italic">tienda</span>
          </h2>
          <Field id="email" label="Correo" error={errors.email}>
            <input
              id="email"
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
              className={inputClass(Boolean(errors.email))}
            />
          </Field>
          <Field
            id="password"
            label="Contraseña"
            error={errors.password}
            hint="Mínimo 8 caracteres"
          >
            <input
              id="password"
              type="password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              className={inputClass(Boolean(errors.password))}
            />
          </Field>

          <StoreProfileFields
            values={values}
            errors={errors}
            onChange={(field: keyof SellerProfileInput, value) =>
              set(field, value)
            }
          />

          <FormError message={formError} />
          <button
            type="submit"
            disabled={submitting}
            className={`${primaryButton} w-full`}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Crear mi tienda
          </button>
          <p className="text-center text-sm text-ink/60">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/entrar"
              className="font-semibold text-brand hover:underline"
            >
              Entra aquí
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
