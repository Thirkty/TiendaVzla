// Tipos de dominio, estado global y props de componentes.
// Única fuente de verdad para el tipado del proyecto.

/* ---------- Dominio ---------- */

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceUsd: number;
  stock: number;
  imageUrl: string;
  originalPriceUsd?: number | null;
  category?: string | null;
  badge?: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

/** Datos del cliente que se envían en el checkout (camelCase, igual que la API). */
export interface CustomerInput {
  cedula: string;
  name: string;
  phone: string;
  addressState: string;
  addressCity: string;
  addressStreet: string;
  addressReference?: string;
}

export type CustomerField = keyof CustomerInput;

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  priceAtPurchase: number;
  product: Pick<Product, "id" | "slug" | "name" | "imageUrl">;
}

/** Orden tal como la devuelve POST /api/checkout y POST /api/orders/{id}/pay. */
export interface Order {
  id: string;
  status: OrderStatus;
  totalUsd: number;
  totalVes: number;
  bcvRate: number;
  paymentReference: string | null;
  createdAt: string;
  items: OrderItem[];
}

/* ---------- Estado global (Zustand) ---------- */

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  /** Agrega un producto. Devuelve false si ya se alcanzó el stock. */
  addItem: (product: Product, quantity?: number) => boolean;
  removeItem: (productId: string) => void;
  /** Fija la cantidad (se limita al stock; 0 o menos elimina el item). */
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  /** Selector: total del carrito en USD. */
  totalUsd: () => number;
}

/** Parte del estado que se guarda en localStorage. */
export type PersistedCartState = Pick<CartState, "items">;

/* ---------- Props de componentes ---------- */

export interface ProductCardProps {
  product: Product;
}

export interface ProductGridProps {
  productsPromise: Promise<Product[]>;
}
