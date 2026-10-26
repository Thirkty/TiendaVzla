"use client";
// WhatsAppButton: botón flotante con efecto "breathing" que abre un chat de WhatsApp,
// con tooltip "¿Necesitas ayuda?" al pasar el mouse.

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

// Reemplaza por el número real (formato internacional, sin "+" ni espacios).
const WHATSAPP_NUMBER = "584120000000";
const WHATSAPP_MESSAGE = "¡Hola TiendaVzla! Tengo una pregunta sobre un producto.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export default function WhatsAppButton() {
  return (
    <div className="group fixed bottom-6 right-6 z-40">
      <span
        role="tooltip"
        className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-sm font-medium text-white opacity-0 shadow-lg transition duration-200 group-hover:translate-x-0 group-hover:opacity-100"
      >
        ¿Necesitas ayuda?
      </span>

      <motion.a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg ring-4 ring-whatsapp/20 transition-shadow hover:shadow-xl"
      >
        <MessageCircle className="size-7" strokeWidth={2.2} />
      </motion.a>
    </div>
  );
}
