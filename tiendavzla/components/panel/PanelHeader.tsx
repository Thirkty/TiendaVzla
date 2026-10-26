// PanelHeader: barra superior de los paneles (admin y vendedor) con enlace a la tienda,
// accesos entre paneles y botón de salir.
import Link from "next/link";
import { LogOut, Store } from "lucide-react";
import type { Me } from "@/lib/api/types";

interface PanelHeaderProps {
  me: Me;
  current: "admin" | "vendedor";
  onLogout: () => void;
}

export default function PanelHeader({ me, current, onLogout }: PanelHeaderProps) {
  const links = [
    me.isAdmin && { href: "/admin", label: "Admin", key: "admin" },
    me.seller && { href: "/vendedor", label: "Mi tienda", key: "vendedor" },
  ].filter(Boolean) as { href: string; label: string; key: string }[];

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-brand">
            TiendaVzla
          </Link>
          {links.length > 1 && (
            <nav className="flex gap-1">
              {links.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  aria-current={link.key === current ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    link.key === current ? "bg-deep text-white" : "text-ink/60 hover:bg-line/60"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
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
