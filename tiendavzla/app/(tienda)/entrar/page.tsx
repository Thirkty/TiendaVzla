import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/account/LoginForm";

export const metadata: Metadata = {
  title: "Entrar | TiendaVzla",
  robots: { index: false },
};

export default function LoginPage() {
  // useSearchParams (en LoginForm) necesita un límite de Suspense.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
