import { apiClient } from "./client";
import { Review } from "./types";

export const reviewsApi = {
  listForProduct: (productId: string) =>
    apiClient.get<{ reviews: Review[]; summary: { average: number; count: number } }>(
      `/products/${productId}/reviews`
    ),
  create: (productId: string, input: { rating: number; authorName: string; title?: string; body: string }) =>
    apiClient.post(`/products/${productId}/reviews`, input),
};
