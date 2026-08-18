"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { formatVnd, formatDateTime } from "@/lib/format";
import { paymentsApi } from "@/lib/api/payments";
import { ApiClientError } from "@/lib/api/client";
import { PaymentStatusResult } from "@/lib/api/types";

/** How often the backend is asked whether the transfer has arrived. */
const POLL_INTERVAL_MS = 3000;

/** Payment states that can never change again — polling stops on these. */
const TERMINAL_STATUSES = ["succeeded", "failed", "expired", "refunded"];

function CopyableRow({ label, value, copyValue }: { label: string; value: string; copyValue?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Không thể sao chép, vui lòng copy thủ công");
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-right text-sm font-medium break-all">
        {value}
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-normal text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          {copied ? "Đã copy" : "Copy"}
        </button>
      </span>
    </div>
  );
}

/**
 * Countdown driven by the backend's `expiresAt`. Deliberately not a
 * client-side `setTimeout(15 minutes)`: that would restart on every reload and
 * disagree with the server, which is the only authority on expiry.
 */
function Countdown({ expiresAt }: { expiresAt: string }) {
  const deadline = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remainingMs, setRemainingMs] = useState(() => deadline - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemainingMs(deadline - Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const clamped = Math.max(0, remainingMs);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const isUrgent = clamped <= 120_000;

  return (
    <span className={isUrgent ? "font-semibold text-destructive" : "font-semibold"}>
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

export function PaymentContent({ orderNumber, email }: { orderNumber: string; email: string }) {
  // First fetch asks for the QR image; polls do not, so repeated requests stay cheap.
  /**
   * The QR image is kept here rather than read off the query data, because each
   * poll replaces that data and deliberately omits the QR (re-rendering a PNG
   * every 3s would waste server CPU and mobile data). Holding it in a ref means
   * the image stays on screen for the whole payment window, and it is requested
   * again only if we genuinely do not have it yet.
   */
  const qrDataUrlRef = useRef("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const clearCart = useCartStore((s) => s.clear);

  const { data, error, isLoading, isFetching, refetch } = useQuery<PaymentStatusResult>({
    queryKey: ["payment-status", orderNumber, email],
    queryFn: async () => {
      const result = await paymentsApi.getStatus(orderNumber, email, !qrDataUrlRef.current);
      if (result.payment.qrCodeDataUrl && result.payment.qrCodeDataUrl !== qrDataUrlRef.current) {
        // Ref first so a poll firing before the next render still knows we have it.
        qrDataUrlRef.current = result.payment.qrCodeDataUrl;
        setQrDataUrl(result.payment.qrCodeDataUrl);
      }
      return result;
    },
    // Payment state lives outside this app; never serve it from cache.
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.payment.status;
      // Stop as soon as the payment can no longer change. React Query also stops
      // automatically when this component unmounts, so nothing polls forever.
      if (status && TERMINAL_STATUSES.includes(status)) return false;
      return POLL_INTERVAL_MS;
    },
    // A blip in connectivity must not abort the wait — keep retrying quietly.
    retry: 3,
    retryDelay: 2000,
  });

  const payment = data?.payment;
  const order = data?.order;
  const isPaid = payment?.status === "succeeded";
  const isClosed = payment ? TERMINAL_STATUSES.includes(payment.status) : false;

  /**
   * The cart is emptied here — the one moment we know the money arrived — and
   * not at checkout. A customer who backs out of this screen without paying
   * keeps their cart; an unpaid order releases its stock when it expires.
   */
  useEffect(() => {
    if (isPaid) clearCart();
  }, [isPaid, clearCart]);

  if (isLoading) {
    return (
      <div className="container-lyla py-24 text-center text-sm text-muted-foreground">
        Đang tải thông tin thanh toán...
      </div>
    );
  }

  if (error || !payment || !order) {
    return (
      <div className="container-lyla flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-medium">Không tìm thấy thông tin thanh toán</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error instanceof ApiClientError ? error.message : "Vui lòng kiểm tra lại mã đơn hàng và email."}
        </p>
        <Button variant="outline" className="rounded-full" render={<Link href="/track-order" />}>
          Tra cứu đơn hàng
        </Button>
      </div>
    );
  }

  // --- Paid: the backend confirmed a matching bank transfer ---
  if (isPaid) {
    return (
      <div className="container-lyla flex max-w-lg flex-col items-center py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h1 className="mt-5 font-heading text-3xl font-medium">Thanh toán thành công</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cảm ơn bạn đã đặt hàng.</p>

        <dl className="mt-8 w-full rounded-2xl bg-mint-light p-6 text-left">
          <div className="flex justify-between border-b border-border/60 py-2">
            <dt className="text-xs text-muted-foreground">Mã đơn hàng</dt>
            <dd className="text-sm font-semibold">{order.orderNumber}</dd>
          </div>
          <div className="flex justify-between border-b border-border/60 py-2">
            <dt className="text-xs text-muted-foreground">Số tiền</dt>
            <dd className="text-sm font-semibold">{formatVnd(payment.amount)}</dd>
          </div>
          <div className="flex justify-between border-b border-border/60 py-2">
            <dt className="text-xs text-muted-foreground">Phương thức</dt>
            <dd className="text-sm">Chuyển khoản {payment.bank.name}</dd>
          </div>
          {payment.paidAt && (
            <div className="flex justify-between py-2">
              <dt className="text-xs text-muted-foreground">Thời gian</dt>
              <dd className="text-sm">{formatDateTime(payment.paidAt)}</dd>
            </div>
          )}
        </dl>

        <p className="mt-6 text-sm text-muted-foreground">
          Đơn hàng đã được xác nhận và sẽ được xử lý sớm.
          <br />
          Email xác nhận đã được gửi tới <span className="font-medium text-foreground">{order.email}</span>.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            className="rounded-full"
            render={<Link href={`/orders/${order.orderNumber}?email=${encodeURIComponent(order.email)}`} />}
          >
            Xem đơn hàng
          </Button>
          <Button variant="outline" className="rounded-full" render={<Link href="/products" />}>
            Tiếp tục mua sắm
          </Button>
        </div>
      </div>
    );
  }

  // --- Closed without payment: expired, failed or refunded ---
  if (isClosed) {
    return (
      <div className="container-lyla flex max-w-lg flex-col items-center py-16 text-center">
        <h1 className="font-heading text-3xl font-medium">Đơn hàng đã hết thời gian thanh toán</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Chúng tôi chưa nhận được khoản chuyển khoản cho đơn hàng{" "}
          <span className="font-medium text-foreground">{order.orderNumber}</span>, nên đơn đã được huỷ và sản phẩm
          được trả lại kho.
          <br />
          Nếu bạn đã chuyển khoản, vui lòng liên hệ với chúng tôi kèm mã{" "}
          <span className="font-medium text-foreground">{payment.paymentCode}</span> để được hỗ trợ.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button className="rounded-full" render={<Link href="/products" />}>
            Mua lại
          </Button>
          <Button variant="outline" className="rounded-full" render={<Link href="/contact" />}>
            Liên hệ hỗ trợ
          </Button>
        </div>
      </div>
    );
  }

  // --- Awaiting the transfer ---
  return (
    <div className="container-lyla max-w-3xl py-10">
      <div className="text-center">
        <h1 className="font-heading text-3xl font-medium">Thanh toán đơn hàng</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Đơn hàng <span className="font-medium text-foreground">{order.orderNumber}</span> · Quét mã VietQR bằng ứng
          dụng ngân hàng để chuyển khoản.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-border bg-background p-3">
            {/* Read from the cached copy, not from `payment` — polls intentionally
                return an empty qrCodeDataUrl. */}
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={`Mã VietQR chuyển khoản ${payment.paymentCode}`}
                width={240}
                height={240}
                unoptimized
                className="size-[240px]"
              />
            ) : (
              <div className="flex size-[240px] items-center justify-center text-xs text-muted-foreground">
                Đang tải mã QR...
              </div>
            )}
          </div>
          <p className="max-w-[240px] text-center text-xs text-muted-foreground">
            Mã QR đã bao gồm số tiền và nội dung chuyển khoản.
          </p>
        </div>

        <div>
          <div className="rounded-2xl bg-mint-light p-5">
            <p className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Thông tin chuyển khoản
            </p>
            <CopyableRow label="Ngân hàng" value={payment.bank.name} />
            <CopyableRow label="Số tài khoản" value={payment.bank.accountNumber} />
            {payment.bank.accountName && <CopyableRow label="Tên người nhận" value={payment.bank.accountName} />}
            <CopyableRow label="Số tiền" value={formatVnd(payment.amount)} copyValue={String(payment.amount)} />
            <CopyableRow label="Nội dung chuyển khoản" value={payment.paymentCode} />
          </div>

          <div className="mt-4 rounded-xl border border-border px-4 py-3 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-muted-foreground">⏱ Thời gian thanh toán còn lại</span>
              <Countdown expiresAt={payment.expiresAt} />
            </p>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Vui lòng chuyển <span className="font-medium text-foreground">đúng số tiền</span> và giữ nguyên nội dung{" "}
            <span className="font-medium text-foreground">{payment.paymentCode}</span> để đơn hàng được xác nhận tự
            động. Trang này sẽ tự cập nhật ngay khi chúng tôi nhận được tiền — bạn không cần tải lại.
          </p>

          <Button
            className="mt-5 w-full rounded-full"
            disabled={isFetching}
            onClick={() => {
              // Only asks the backend to re-check. It can never mark the payment
              // paid — that decision belongs to the verified bank webhook.
              void refetch();
              toast.info("Đang kiểm tra thanh toán...");
            }}
          >
            {isFetching ? "Đang kiểm tra thanh toán..." : "Tôi đã chuyển khoản"}
          </Button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Đang chờ xác nhận từ ngân hàng. Bạn có thể đóng trang này — đơn hàng vẫn được xử lý và email xác nhận sẽ
            được gửi tới {order.email}.
          </p>
        </div>
      </div>
    </div>
  );
}
