import { apiClient } from "./client";
import { toQueryString } from "./query-string";
import { getCsrfToken } from "@/lib/csrf";
import {
  AdminUser,
  BankTransaction,
  Category,
  Coupon,
  Customer,
  DashboardStats,
  Order,
  OrderWithPayment,
  Product,
  Settings,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const adminApi = {
  // Neither returns a token: the session lives entirely in the httpOnly
  // cookie the browser stores on its own. Both hand back a `csrfToken` this
  // app holds in memory (see lib/csrf.ts) — `me` is what recovers it after a
  // page reload wipes that in-memory copy.
  login: (email: string, password: string) =>
    apiClient.post<{ admin: AdminUser; csrfToken: string }>("/admin/auth/login", { email, password }),
  me: () => apiClient.get<AdminUser & { csrfToken: string }>("/admin/auth/me"),
  logout: () => apiClient.post<{ loggedOut: true }>("/admin/auth/logout"),

  dashboard: () => apiClient.get<DashboardStats>("/admin/dashboard"),

  products: {
    list: (filters: Record<string, string | number | undefined> = {}) =>
      apiClient.getPaginated<Product>(`/products/admin/all${toQueryString(filters)}`),
    get: (id: string) => apiClient.get<Product>(`/products/admin/${id}`),
    create: (data: Partial<Product>) => apiClient.post<Product>("/products", data),
    update: (id: string, data: Partial<Product>) => apiClient.patch<Product>(`/products/${id}`, data),
    remove: (id: string) => apiClient.delete(`/products/${id}`),
    updateInventory: (id: string, sku: string, inventoryQty: number) =>
      apiClient.patch(`/products/${id}/inventory`, { sku, inventoryQty }),
    /**
     * Bypasses `apiClient` because `FormData` needs the browser to set its own
     * multipart `Content-Type` (with boundary) — never set that header by
     * hand. Auth and CSRF still go through the same cookie + header mechanism
     * as every other mutating request.
     */
    uploadImage: async (file: File) => {
      const form = new FormData();
      form.append("image", file);
      const csrfToken = getCsrfToken();
      const res = await fetch(`${API_URL}/products/upload-image`, {
        method: "POST",
        credentials: "include",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : undefined,
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Tải ảnh thất bại");
      return json.data as { url: string; publicId: string };
    },
  },

  categories: {
    list: () => apiClient.get<Category[]>("/categories/admin/all"),
    create: (data: Partial<Category>) => apiClient.post<Category>("/categories", data),
    update: (id: string, data: Partial<Category>) => apiClient.patch<Category>(`/categories/${id}`, data),
    remove: (id: string) => apiClient.delete(`/categories/${id}`),
  },

  orders: {
    list: (filters: Record<string, string | number | undefined> = {}) =>
      apiClient.getPaginated<Order>(`/orders/admin/all${toQueryString(filters)}`),
    get: (id: string) => apiClient.get<OrderWithPayment>(`/orders/admin/${id}`),
    updateStatus: (id: string, data: Record<string, unknown>) =>
      apiClient.patch<Order>(`/orders/admin/${id}/status`, data),
    cancel: (id: string) => apiClient.post<Order>(`/orders/admin/${id}/cancel`, undefined),
  },

  customers: {
    list: (filters: Record<string, string | number | undefined> = {}) =>
      apiClient.getPaginated<Customer>(`/customers/admin/all${toQueryString(filters)}`),
  },

  /** Incoming bank transfers reported by the notification provider (SePay). */
  bankTransactions: {
    list: (filters: Record<string, string | number | undefined> = {}) =>
      apiClient.getPaginated<BankTransaction>(`/payments/admin/bank-transactions${toQueryString(filters)}`, {
        cache: "no-store",
      }),
  },

  coupons: {
    list: () => apiClient.get<Coupon[]>("/coupons/admin/all"),
    create: (data: Partial<Coupon>) => apiClient.post<Coupon>("/coupons/admin", data),
    update: (id: string, data: Partial<Coupon>) => apiClient.patch<Coupon>(`/coupons/admin/${id}`, data),
    remove: (id: string) => apiClient.delete(`/coupons/admin/${id}`),
  },

  settings: {
    update: (data: Partial<Settings>) => apiClient.patch<Settings>("/settings", data),
  },
};
