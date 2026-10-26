// PanelHeader: barra superior del panel de admin con enlace a la tienda y botón de salir.
import Link from "next/link";
import { LogOut, Store } from "lucide-react";
import type { Me } from "@/lib/api/types";

export default function PanelHeader({ me, onLogout }: { me: Me; onLogout: () => void }) {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-brand">
            TiendaVzla
          </Link>
          <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden text-sm text-ink/50 sm:inline">{me.email}</span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink/60 hover:bg-line/60"
          >
            <Store className="size-4" />
            <span className="hidden sm:inline">Ver tienda</span>
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink/60 hover:bg-line/60"
          >
            <LogOut className="size-4" />
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
