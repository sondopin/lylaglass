import { apiClient } from "./client";
import { Address, Order } from "./types";

export interface CheckoutInput {
  customer: { name: string; email: string; phone: string };
  shippingAddress: Address;
  billingAddress?: Address;
  items: Array<{ productId: string; sku: string; quantity: number }>;
  couponCode?: string;
  customerNote?: string;
  paymentMethod: "cod" | "card" | "bank_transfer" | "mock";
}

export interface CheckoutResult {
  order: Order;
  payment: { intentId: string; status: string } | null;
  redirectUrl: string | null;
}

export const checkoutApi = {
  submit: (input: CheckoutInput) => apiClient.post<CheckoutResult>("/checkout", input),
};
