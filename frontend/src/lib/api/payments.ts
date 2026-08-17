import { apiClient } from "./client";
import { PaymentStatusResult } from "./types";

export const paymentsApi = {
  /**
   * Reads the authoritative payment state for a guest order.
   *
   * This is the storefront's only source of truth about payment: the frontend
   * polls it and reacts, but never tells the backend that a transfer happened —
   * only a verified bank webhook can do that.
   *
   * `includeQr` is set on first load/reload (the QR has to be rendered) and left
   * off while polling, so repeated polls stay cheap.
   */
  getStatus: (orderNumber: string, email: string, includeQr = false) =>
    apiClient.get<PaymentStatusResult>(
      `/orders/${encodeURIComponent(orderNumber)}/payment-status?email=${encodeURIComponent(email)}${
        includeQr ? "&includeQr=true" : ""
      }`,
      // Payment state changes out-of-band; a cached response would show a
      // customer who has already paid a stale "waiting for transfer" screen.
      { cache: "no-store" }
    ),
};
