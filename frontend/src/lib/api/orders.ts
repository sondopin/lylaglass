import { apiClient } from "./client";
import { Order } from "./types";

export const ordersApi = {
  lookup: (orderNumber: string, email: string) =>
    apiClient.get<Order>(`/orders/lookup/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`),
};
