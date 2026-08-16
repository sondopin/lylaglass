const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const paymentsApi = {
  /** Stands in for the payment provider calling our webhook after the customer completes payment on its hosted page. */
  simulateWebhook: async (input: { intentId: string; amount: number; currency: string; outcome: "succeeded" | "failed" }) => {
    const res = await fetch(`${API_URL}/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message ?? "Webhook thất bại");
    return json.data;
  },
};
