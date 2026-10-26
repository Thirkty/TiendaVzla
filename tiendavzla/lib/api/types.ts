// Tipos de dominio, estado global y props de componentes.
// Única fuente de verdad para el tipado del proyecto.

/* ---------- Dominio ---------- */

export interface SellerSummary {
  id: string;
  storeName: string;
  slug: string;
}

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
  /** Costo de envío que define el vendedor (0 = gratis). */
  shippingCostUsd?: number;
  seller?: SellerSummary;
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
  | "PAYMENT_SUBMITTED"
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

/** Datos del vendedor que el cliente necesita para pagarle y contactarlo. */
export interface OrderSeller {
  storeName: string;
  slug: string;
  whatsapp: string;
  pagoMovilBank: string;
  pagoMovilPhone: string;
  pagoMovilId: string;
}

/** Orden (de UN vendedor) tal como la devuelven el checkout y POST /api/orders/{id}/pay. */
export interface Order {
  id: string;
  checkoutId: string;
  status: OrderStatus;
  seller: OrderSeller;
  subtotalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  totalVes: number;
  bcvRate: number;
  paymentReference: string | null;
  createdAt: string;
  /** Mientras está PENDING: hora límite para enviar la referencia. */
  expiresAt: string | null;
  paymentSubmittedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
}

export interface CheckoutResult {
  checkoutId: string;
  orders: Order[];
}

export interface AdminCustomer {
  id: string;
  cedula: string;
  name: string;
  phone: string;
  addressState: string;
  addressCity: string;
  addressStreet: string;
  addressReference: string | null;
}

/** Datos de contacto y envío escritos por el cliente en un pedido. */
export interface ShippingInfo {
  name: string;
  cedula: string;
  phone: string;
  addressState: string;
  addressCity: string;
  addressStreet: string;
  addressReference: string | null;
}

/** Orden con sus datos de envío (panel del vendedor). */
export interface SellerOrder extends Order {
  /** Datos de ESTE pedido: son los que hay que usar para despachar y contactar. */
  shipping: ShippingInfo;
}

/** Orden vista por el admin: además, el cliente vinculado por cédula. */
export interface AdminOrder extends SellerOrder {
  customer: AdminCustomer;
}

export interface ExchangeRate {
  rate: number;
  source: "bcv" | "dolarapi" | "manual" | "env";
  /** "Fecha Valor" del BCV (YYYY-MM-DD): desde ese día rige la tasa. */
  validFrom: string;
  sourceDate: string | null;
  updatedAt: string;
}

/** Estado de la tasa para el panel de admin (GET /api/admin/rate/status). */
export interface RateStatus {
  current: ExchangeRate;
  upcoming: ExchangeRate | null;
  businessDaysBehind: number;
  stale: boolean;
  lastCheck: { at: string; ok: boolean; source: string | null; error: string | null } | null;
}

/* ---------- Cuentas y panel de admin ---------- */

/** Configuración de la tienda: lo que ve el cliente para pagar y escribir. */
export interface StoreSettings {
  storeName: string;
  whatsapp: string;
  pagoMovilBank: string;
  pagoMovilPhone: string;
  pagoMovilId: string;
}

export interface Me {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface ProductInput {
  name: string;
  description: string;
  priceUsd: number;
  originalPriceUsd: number | null;
  shippingCostUsd: number;
  stock: number;
  imageUrl: string;
  category: string | null;
  badge: string | null;
  isActive: boolean;
}

export interface AdminProduct extends Product {
  isActive: boolean;
  shippingCostUsd: number;
  updatedAt: string | null;
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
