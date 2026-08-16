import { apiClient, Paginated } from "./client";
import { toQueryString } from "./query-string";
import { Product } from "./types";

export interface ProductListFilters {
  page?: number;
  limit?: number;
  category?: string;
  q?: string;
  sort?: "featured" | "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "bestselling";
  minPrice?: number;
  maxPrice?: number;
  tag?: string;
  inStockOnly?: boolean;
}

export const productsApi = {
  list: (filters: ProductListFilters = {}) =>
    apiClient.getPaginated<Product>(`/products${toQueryString(filters)}`, { next: { revalidate: 60 } }),
  getBySlug: (slug: string) =>
    apiClient.get<{ product: Product; related: Product[] }>(`/products/${slug}`, { next: { revalidate: 60 } }),
};

export type { Paginated };
