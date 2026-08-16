import { apiClient } from "./client";
import { toQueryString } from "./query-string";
import { AdminUser, Category, Coupon, Customer, DashboardStats, Order, Product, Settings } from "./types";

export const adminApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; admin: AdminUser }>("/admin/auth/login", { email, password }),
  me: (token: string) => apiClient.get<AdminUser>("/admin/auth/me", { token }),

  dashboard: (token: string) => apiClient.get<DashboardStats>("/admin/dashboard", { token }),

  products: {
    list: (token: string, filters: Record<string, string | number | undefined> = {}) =>
      apiClient.getPaginated<Product>(`/products/admin/all${toQueryString(filters)}`, { token }),
    get: (token: string, id: string) => apiClient.get<Product>(`/products/admin/${id}`, { token }),
    create: (token: string, data: Partial<Product>) => apiClient.post<Product>("/products", data, { token }),
    update: (token: string, id: string, data: Partial<Product>) =>
      apiClient.patch<Product>(`/products/${id}`, data, { token }),
    remove: (token: string, id: string) => apiClient.delete(`/products/${id}`, { token }),
    updateInventory: (token: string, id: string, sku: string, inventoryQty: number) =>
      apiClient.patch(`/products/${id}/inventory`, { sku, inventoryQty }, { token }),
    uploadImage: async (token: string, file: File) => {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/products/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Tải ảnh thất bại");
      return json.data as { url: string; publicId: string };
    },
  },

  categories: {
    list: (token: string) => apiClient.get<Category[]>("/categories/admin/all", { token }),
    create: (token: string, data: Partial<Category>) => apiClient.post<Category>("/categories", data, { token }),
    update: (token: string, id: string, data: Partial<Category>) =>
      apiClient.patch<Category>(`/categories/${id}`, data, { token }),
    remove: (token: string, id: string) => apiClient.delete(`/categories/${id}`, { token }),
  },

  orders: {
    list: (token: string, filters: Record<string, string | number | undefined> = {}) =>
      apiClient.getPaginated<Order>(`/orders/admin/all${toQueryString(filters)}`, { token }),
    get: (token: string, id: string) => apiClient.get<Order>(`/orders/admin/${id}`, { token }),
    updateStatus: (token: string, id: string, data: Record<string, unknown>) =>
      apiClient.patch<Order>(`/orders/admin/${id}/status`, data, { token }),
    cancel: (token: string, id: string) => apiClient.post<Order>(`/orders/admin/${id}/cancel`, undefined, { token }),
  },

  customers: {
    list: (token: string, filters: Record<string, string | number | undefined> = {}) =>
      apiClient.getPaginated<Customer>(`/customers/admin/all${toQueryString(filters)}`, { token }),
  },

  coupons: {
    list: (token: string) => apiClient.get<Coupon[]>("/coupons/admin/all", { token }),
    create: (token: string, data: Partial<Coupon>) => apiClient.post<Coupon>("/coupons/admin", data, { token }),
    update: (token: string, id: string, data: Partial<Coupon>) =>
      apiClient.patch<Coupon>(`/coupons/admin/${id}`, data, { token }),
    remove: (token: string, id: string) => apiClient.delete(`/coupons/admin/${id}`, { token }),
  },

  settings: {
    update: (token: string, data: Partial<Settings>) => apiClient.patch<Settings>("/settings", data, { token }),
  },
};
