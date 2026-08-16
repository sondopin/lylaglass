import { apiClient } from "./client";

export interface CouponEvaluation {
  code: string;
  type: "percentage" | "fixed" | "free_shipping";
  discountTotal: number;
  freeShipping: boolean;
}

export const couponsApi = {
  validate: (code: string, subtotal: number) =>
    apiClient.post<CouponEvaluation>("/coupons/validate", { code, subtotal }),
};
