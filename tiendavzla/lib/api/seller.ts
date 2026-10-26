// Endpoints del panel del vendedor (/api/seller/*).
import { sessionFetch } from "./session";
import type { SellerProduct, SellerProductInput, SellerProfile, SellerProfileInput } from "./types";

export const sellerApi = {
  store: () => sessionFetch<SellerProfile>("/api/seller/me"),
  updateStore: (data: SellerProfileInput) =>
    sessionFetch<SellerProfile>("/api/seller/me", { method: "PUT", json: data }),

  products: () => sessionFetch<SellerProduct[]>("/api/seller/products"),
  createProduct: (data: SellerProductInput) =>
    sessionFetch<SellerProduct>("/api/seller/products", { json: data }),
  updateProduct: (id: string, data: Partial<SellerProductInput>) =>
    sessionFetch<SellerProduct>(`/api/seller/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      json: data,
    }),

  /** Sube una foto; la API la valida, la achica y devuelve su URL. */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return sessionFetch<{ url: string }>("/api/seller/uploads", { form });
  },
};
