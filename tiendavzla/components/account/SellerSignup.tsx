"use client";
// SellerSignup: registro de vendedores. Crea la cuenta y la tienda (queda en revisión)
// y entra directo al panel del vendedor.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Smartphone, Store } from "lucide-react";
import { accountApi, SessionApiError, type SellerRegistration } from "@/lib/api/session";
import type { SellerProfileInput } from "@/lib/api/types";
import { Field, FormError, inputClass, primaryButton } from "@/components/ui/form";
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

const BENEFITS = [
  { icon: Store, text: "Publica tus productos con tu precio y tu costo de envío" },
  { icon: Smartphone, text: "Los clientes te pagan directo a tu Pago Móvil" },
  { icon: BadgeCheck, text: "Revisamos cada tienda para que los compradores confíen" },
];

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
      await accountApi.registerSeller({ ...values, email: values.email.trim() });
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
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_440px]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Vende con nosotros</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Abre tu tienda en TiendaVzla
        </h1>
        <p className="mt-3 max-w-md text-ink/60">
          Llega a compradores de toda Venezuela. Tú pones el precio y el envío; nosotros te
          traemos los clientes.
        </p>
        <ul className="mt-8 space-y-4">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span className="rounded-xl bg-brand/10 p-2 text-brand">
                <Icon className="size-5" />
              </span>
              <span className="pt-1.5 font-medium">{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-ink/50">
          Cobramos una pequeña comisión solo cuando vendes.
        </p>
      </div>

      <form
        onSubmit={submit}
        noValidate
        className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm"
      >
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
        <Field id="password" label="Contraseña" error={errors.password} hint="Mínimo 8 caracteres">
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
          onChange={(field: keyof SellerProfileInput, value) => set(field, value)}
        />

        <FormError message={formError} />
        <button type="submit" disabled={submitting} className={`${primaryButton} w-full`}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Crear mi tienda
        </button>
        <p className="text-center text-sm text-ink/60">
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="font-semibold text-brand hover:underline">
            Entra aquí
          </Link>
        </p>
      </form>
    </div>
  );
}
