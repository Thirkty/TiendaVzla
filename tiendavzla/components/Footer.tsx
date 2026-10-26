// Footer: datos de la empresa (RIF), info de envíos, métodos de pago, redes y copyright.
// Componente de servidor: no necesita interactividad.

const SOCIAL_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Instagram", href: "https://instagram.com/" },
  { label: "TikTok", href: "https://tiktok.com/" },
  { label: "Facebook", href: "https://facebook.com/" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer id="contacto" className="bg-deep text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xl font-extrabold text-brand">TiendaVzla</p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Productos útiles para el día a día, con envío a toda Venezuela.
          </p>
          <p className="mt-4 text-sm font-medium text-white/60">RIF: J-123456789</p>
        </div>

        <div id="envios">
          <h3 className="font-bold">Envíos</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>Entrega en 48h a todo el país</li>
            <li>MRW · Zoom · Tealca</li>
            <li>Delivery en Caracas</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold">Métodos de pago</h3>
          <p className="mt-3 text-sm text-white/70">Pago Móvil · Transferencia · Efectivo</p>
        </div>

        <div>
          <h3 className="font-bold">Síguenos</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 transition-colors hover:text-brand"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-white/50 sm:px-6">
          © {year} TiendaVzla. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
