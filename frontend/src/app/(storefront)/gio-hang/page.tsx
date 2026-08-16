"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, cartSubtotal } from "@/store/cart-store";
import { formatVnd } from "@/lib/format";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = cartSubtotal(items);

  return (
    <div className="bg-rose-deep/10 pb-16">
      <div className="py-10 text-center sm:py-14">
        <h1 className="font-heading text-3xl font-medium sm:text-4xl">Giỏ hàng của bạn</h1>
        <Link href="/san-pham" className="mt-2 inline-block text-sm text-foreground/80 underline underline-offset-4">
          Tiếp tục mua sắm
        </Link>
      </div>

      <div className="container-lyla">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-background py-20 text-center">
            <p className="text-muted-foreground">Giỏ hàng của bạn đang trống.</p>
            <Button className="rounded-full" render={<Link href="/san-pham" />}>
              Khám phá sản phẩm
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div className="rounded-2xl bg-background p-4 sm:p-6 lg:col-span-2">
              <div className="hidden grid-cols-[2fr_1fr_1fr] gap-4 border-b border-border pb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:grid">
                <span>Sản phẩm</span>
                <span className="text-center">Số lượng</span>
                <span className="text-right">Thành tiền</span>
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {items.map((item) => (
                  <li key={item.sku} className="grid grid-cols-1 items-center gap-4 py-5 sm:grid-cols-[2fr_1fr_1fr]">
                    <div className="flex gap-3">
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {item.image && <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">LylaGlass</p>
                        <Link href={`/san-pham/${item.slug}`} className="text-sm font-medium hover:underline">
                          {item.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{item.variantName}</p>
                        <p className="mt-1 text-sm">{formatVnd(item.price)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-start gap-3 sm:justify-center">
                      <div className="flex items-center rounded-full border border-border">
                        <button
                          className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
                          onClick={() => setQuantity(item.sku, item.quantity - 1)}
                          aria-label="Giảm số lượng"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm">{item.quantity}</span>
                        <button
                          className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                          onClick={() => setQuantity(item.sku, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          aria-label="Tăng số lượng"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.sku)} className="text-muted-foreground hover:text-destructive" aria-label="Xoá sản phẩm">
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <p className="text-left text-sm font-semibold sm:text-right">{formatVnd(item.price * item.quantity)}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="h-fit rounded-2xl bg-background p-6">
              <h2 className="font-heading text-lg font-medium">Tóm tắt đơn hàng</h2>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tạm tính</span>
                <span className="font-medium">{formatVnd(subtotal)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Phí vận chuyển và mã giảm giá được áp dụng ở bước thanh toán.</p>
              <p className="mt-3 text-xs text-muted-foreground">Thời gian giao hàng dự kiến: 2-5 ngày làm việc (tuỳ khu vực).</p>
              <Button className="mt-5 w-full rounded-full" size="lg" render={<Link href="/thanh-toan" />}>
                Tiến hành thanh toán
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
