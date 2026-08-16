import { apiClient } from "./client";
import { Category } from "./types";

export const categoriesApi = {
  list: () => apiClient.get<Category[]>("/categories", { next: { revalidate: 300 } }),
  getBySlug: (slug: string) => apiClient.get<Category>(`/categories/${slug}`, { next: { revalidate: 300 } }),
};
