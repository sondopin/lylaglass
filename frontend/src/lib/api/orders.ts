import { apiClient } from "./client";
import { Order } from "./types";

export const ordersApi = {
  /**
   * Looks up a guest order by number + the email used at checkout.
   *
   * Never cached: payment and fulfilment status change out-of-band (bank
   * webhook, admin actions), and showing a stale "chờ thanh toán" to a customer
   * who has already paid would be worse than a slightly slower page.
   */
  lookup: (orderNumber: string, email: string) =>
    apiClient.get<Order>(`/orders/lookup/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`, {
      cache: "no-store",
    }),
};
