import { apiClient } from "./client";
import { Address, Order, PaymentMethod, PaymentView } from "./types";

export interface CheckoutInput {
  customer: { name: string; email: string; phone: string };
  shippingAddress: Address;
  billingAddress?: Address;
  items: Array<{ productId: string; sku: string; quantity: number }>;
  couponCode?: string;
  customerNote?: string;
  /** Only bank transfer exists; the server sets it regardless of what is sent. */
  paymentMethod?: PaymentMethod;
}

export interface CheckoutResult {
  order: Order;
  /** VietQR transfer instructions generated server-side for this order. */
  payment: PaymentView;
}

export const checkoutApi = {
  submit: (input: CheckoutInput) => apiClient.post<CheckoutResult>("/checkout", input),
};
