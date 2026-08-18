import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ordersApi } from "@/lib/api/orders";
import { ApiClientError } from "@/lib/api/client";
import { formatVnd, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Params = Promise<{ orderNumber: string }>;
type SearchParams = Promise<{ email?: string }>;

export const metadata: Metadata = { robots: { index: false } };

// Payment and fulfilment state change out-of-band (bank webhook, admin), so this
// page must never be prerendered or served from a cached render.
export const dynamic = "force-dynamic";

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  refunded: "Đã hoàn tiền",
};
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Chuyển khoản ngân hàng (VietQR)",
};
const SHIPPING_STATUS_LABEL: Record<string, string> = {
  unfulfilled: "Chưa giao",
  processing: "Đang chuẩn bị",
  shipped: "Đang giao",
  delivered: "Đã giao",
  returned: "Đã hoàn trả",
};

export default async function OrderConfirmationPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { orderNumber } = await params;
  const { email } = await searchParams;

  if (!email) {
    return (
      <div className="container-lyla flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-medium">Thiếu thông tin email</h1>
        <p className="text-sm text-muted-foreground">Vui lòng tra cứu đơn hàng bằng mã đơn và email đã đặt hàng.</p>
        <Button className="rounded-full" render={<Link href="/track-order" />}>
          Tra cứu đơn hàng
        </Button>
      </div>
    );
  }

  let order;
  try {
    order = await ordersApi.lookup(orderNumber, email);
  } catch (err) {
    return (
      <div className="container-lyla flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-medium">Không tìm thấy đơn hàng</h1>
        <p className="text-sm text-muted-foreground">
          {err instanceof ApiClientError ? err.message : "Vui lòng kiểm tra lại mã đơn hàng và email."}
        </p>
        <Button variant="outline" className="rounded-full" render={<Link href="/track-order" />}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="container-lyla max-w-3xl py-14">
      <div className="text-center">
        {order.paymentStatus === "paid" ? (
          <p className="text-xs font-semibold tracking-widest text-emerald-600 uppercase">
            Đã thanh toán · Đã xác nhận đơn hàng
          </p>
        ) : order.paymentStatus === "pending" ? (
          <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">Chờ thanh toán</p>
        ) : (
          <p className="text-xs font-semibold tracking-widest text-destructive uppercase">
            {PAYMENT_STATUS_LABEL[order.paymentStatus]}
          </p>
        )}
        <h1 className="mt-2 font-heading text-3xl font-medium">Cảm ơn bạn đã mua sắm tại LylaGlass!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mã đơn hàng <span className="font-medium text-foreground">{order.orderNumber}</span> — đặt lúc{" "}
          {formatDateTime(order.createdAt)}
        </p>

        {order.paymentStatus === "pending" && order.orderStatus !== "cancelled" && (
          <div className="mt-5 inline-flex flex-col items-center gap-2 rounded-2xl bg-mint-light px-6 py-4">
            <p className="text-sm">Đơn hàng đang chờ bạn chuyển khoản qua VietQR.</p>
            <Button
              className="rounded-full"
              render={<Link href={`/checkout/${order.orderNumber}?email=${encodeURIComponent(email)}`} />}
            >
              Tiếp tục thanh toán
            </Button>
          </div>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground">Trạng thái đơn hàng</p>
          <p className="mt-1 text-sm font-medium">{ORDER_STATUS_LABEL[order.orderStatus]}</p>
        </div>
        <div className="rounded-xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground">Thanh toán</p>
          <p className="mt-1 text-sm font-medium">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
          <p className="text-xs text-muted-foreground">
            {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
          </p>
        </div>
        <div className="rounded-xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground">Vận chuyển</p>
          <p className="mt-1 text-sm font-medium">{SHIPPING_STATUS_LABEL[order.shippingStatus]}</p>
          {order.trackingNumber && <p className="text-xs text-muted-foreground">Mã vận đơn: {order.trackingNumber}</p>}
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-heading text-lg font-medium">Địa chỉ giao hàng</h2>
          <p className="text-sm">{order.shippingAddress.fullName}</p>
          <p className="text-sm text-muted-foreground">{order.shippingAddress.phone}</p>
          <p className="text-sm text-muted-foreground">
            {[order.shippingAddress.line1, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.province]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <div>
          <h2 className="mb-3 font-heading text-lg font-medium">Liên hệ</h2>
          <p className="text-sm">{order.customer.name}</p>
          <p className="text-sm text-muted-foreground">{order.customer.email}</p>
          <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-4 font-heading text-lg font-medium">Sản phẩm</h2>
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {order.items.map((item) => (
            <li key={item.sku} className="flex items-center gap-4 p-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.image && <Image src={item.image} alt={item.productName} fill sizes="64px" className="object-cover" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantName} × {item.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold">{formatVnd(item.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 ml-auto flex max-w-xs flex-col gap-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Tạm tính</span>
            <span>{formatVnd(order.subtotal)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Giảm giá {order.couponCode && `(${order.couponCode})`}</span>
              <span>-{formatVnd(order.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Phí vận chuyển</span>
            <span>{formatVnd(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
            <span>Tổng cộng</span>
            <span>{formatVnd(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <Button variant="outline" className="rounded-full" render={<Link href="/products" />}>
          Tiếp tục mua sắm
        </Button>
      </div>
    </div>
  );
}
