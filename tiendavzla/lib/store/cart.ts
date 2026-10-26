// Estado global del carrito con Zustand + persistencia en localStorage.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartState, PersistedCartState } from "@/lib/api/types";
import { roundMoney } from "@/lib/utils/format";

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, quantity = 1) => {
        const items = get().items;
        const existing = items.find((i) => i.product.id === product.id);
        const current = existing?.quantity ?? 0;

        if (current >= product.stock) return false;

        const nextQty = Math.min(current + quantity, product.stock);

        set({
          items: existing
            ? items.map((i) => (i.product.id === product.id ? { ...i, quantity: nextQty } : i))
            : [...items, { product, quantity: nextQty }],
        });
        return true;
      },

      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.product.id !== productId) }),

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.product.id === productId
              ? { ...i, quantity: Math.min(quantity, i.product.stock) }
              : i,
          ),
        });
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      totalUsd: () =>
        roundMoney(get().items.reduce((sum, i) => sum + i.product.priceUsd * i.quantity, 0)),
    }),
    {
      name: "tiendavzla-cart",
      // v1: los ids pasaron de "p-001" (mock) a UUID de la base de datos.
      // v2: cada producto trae su vendedor y costo de envío (marketplace).
      // Los carritos guardados con una versión anterior se descartan.
      version: 2,
      migrate: (): PersistedCartState => ({ items: [] }),
      storage: createJSONStorage(() => localStorage),
      // Solo guardamos los items; el drawer siempre arranca cerrado.
      partialize: (state): PersistedCartState => ({ items: state.items }),
      // Rehidratamos manualmente en el cliente (ver Navbar) para evitar
      // errores de hidratación entre servidor y navegador.
      skipHydration: true,
    },
  ),
);

/** Selector: cantidad total de unidades en el carrito (para el badge). */
export const selectTotalItems = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);
