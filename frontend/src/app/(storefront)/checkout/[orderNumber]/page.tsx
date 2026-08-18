import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PaymentContent } from "./payment-content";

type Params = Promise<{ orderNumber: string }>;
type SearchParams = Promise<{ email?: string }>;

export const metadata: Metadata = { robots: { index: false } };

/**
 * VietQR payment page for a guest order.
 *
 * All payment data (amount, payment code, bank account, deadline) is fetched
 * from the backend by the client component — nothing about payment is passed
 * through the URL, and the page never decides that a payment succeeded.
 */
export default async function PaymentPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { orderNumber } = await params;
  const { email } = await searchParams;

  if (!email) {
    return (
      <div className="container-lyla flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-medium">Thiếu thông tin email</h1>
        <p className="text-sm text-muted-foreground">
          Vui lòng tra cứu đơn hàng bằng mã đơn và email đã dùng khi đặt hàng.
        </p>
        <Button className="rounded-full" render={<Link href="/track-order" />}>
          Tra cứu đơn hàng
        </Button>
      </div>
    );
  }

  return <PaymentContent orderNumber={orderNumber} email={email} />;
}
