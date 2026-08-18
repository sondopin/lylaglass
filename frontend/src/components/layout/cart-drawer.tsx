"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore, cartCount, cartSubtotal } from "@/store/cart-store";
import { formatVnd } from "@/lib/format";

export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isDrawerOpen);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const subtotal = cartSubtotal(items);
  const count = cartCount(items);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-xl">Giỏ hàng của bạn ({count})</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <p>Giỏ hàng đang trống.</p>
            <Button onClick={closeDrawer} variant="secondary" className="rounded-full" render={<Link href="/products" />}>
              Khám phá sản phẩm
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li key={item.sku} className="flex gap-3">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.image && <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">LylaGlass</p>
                      <p className="text-sm font-medium leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.variantName}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center rounded-full border border-border">
                          <button
                            className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            onClick={() => setQuantity(item.sku, item.quantity - 1)}
                            aria-label="Giảm số lượng"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => setQuantity(item.sku, item.quantity + 1)}
                            disabled={item.quantity >= item.maxQuantity}
                            aria-label="Tăng số lượng"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold">{formatVnd(item.price * item.quantity)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.sku)}
                      className="self-start text-muted-foreground hover:text-destructive"
                      aria-label="Xoá sản phẩm"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t px-5 py-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Tạm tính</span>
                <span className="font-semibold text-foreground">{formatVnd(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Phí vận chuyển và <Link href="/cart" className="underline">mã giảm giá</Link> được tính ở bước thanh toán.
              </p>
              <Separator className="my-4" />
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="rounded-full" onClick={closeDrawer} render={<Link href="/cart" />}>
                  Xem giỏ hàng
                </Button>
                <Button className="rounded-full" onClick={closeDrawer} render={<Link href="/checkout" />}>
                  Thanh toán — {formatVnd(subtotal)}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
