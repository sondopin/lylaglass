import { Suspense } from "react";
import { MockPaymentContent } from "./mock-payment-content";

export default function MockPaymentPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-muted-foreground">Đang tải...</div>}>
      <MockPaymentContent />
    </Suspense>
  );
}
