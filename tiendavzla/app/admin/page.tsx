// Panel de administración: verificar pagos, mover pedidos de estado y gestionar la tasa BCV.
import type { Metadata } from "next";
import AdminPanel from "@/components/admin/AdminPanel";

export const metadata: Metadata = {
  title: "Panel | TiendaVzla",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
