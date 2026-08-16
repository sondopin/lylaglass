"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/format";
import { paymentsApi } from "@/lib/api/payments";

export function MockPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState<"succeeded" | "failed" | null>(null);

  const intentId = searchParams.get("intent") ?? "";
  const orderNumber = searchParams.get("order") ?? "";
  const amount = Number(searchParams.get("amount") ?? 0);
  const email = searchParams.get("email") ?? "";

  async function handleOutcome(outcome: "succeeded" | "failed") {
    setLoading(outcome);
    try {
      await paymentsApi.simulateWebhook({ intentId, amount, currency: "VND", outcome });
      if (outcome === "succeeded") {
        router.push(`/don-hang/${orderNumber}?email=${encodeURIComponent(email)}`);
      } else {
        toast.error("Thanh toán thất bại. Đơn hàng đã được huỷ và tồn kho đã hoàn lại.");
        router.push("/gio-hang");
      }
    } catch {
      toast.error("Có lỗi xảy ra khi xử lý thanh toán giả lập.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="container-lyla flex flex-col items-center gap-6 py-24 text-center">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Cổng thanh toán giả lập</p>
      <h1 className="font-heading text-3xl font-medium">Xác nhận thanh toán</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Đây là trang mô phỏng cổng thanh toán bên ngoài dành cho môi trường phát triển. Đơn hàng{" "}
        <span className="font-medium text-foreground">{orderNumber}</span> — tổng tiền{" "}
        <span className="font-medium text-foreground">{formatVnd(amount)}</span>.
      </p>
      <div className="flex gap-3">
        <Button className="rounded-full" disabled={!!loading} onClick={() => handleOutcome("succeeded")}>
          {loading === "succeeded" ? "Đang xử lý..." : "Giả lập thanh toán thành công"}
        </Button>
        <Button variant="outline" className="rounded-full" disabled={!!loading} onClick={() => handleOutcome("failed")}>
          {loading === "failed" ? "Đang xử lý..." : "Giả lập thanh toán thất bại"}
        </Button>
      </div>
    </div>
  );
}
