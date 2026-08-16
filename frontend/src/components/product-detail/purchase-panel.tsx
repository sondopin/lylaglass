"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Product } from "@/lib/api/types";
import { formatVnd } from "@/lib/format";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Truck, ShieldCheck, PackageCheck } from "lucide-react";

export function PurchasePanel({ product }: { product: Product }) {
  const [selectedSku, setSelectedSku] = useState(product.variants[0]?.sku);
  const addItem = useCartStore((s) => s.addItem);

  const variant = product.variants.find((v) => v.sku === selectedSku) ?? product.variants[0];
  const inStock = variant.inventoryQty > 0;

  function handleAddToCart() {
    if (!inStock) return;
    addItem(
      {
        productId: product._id,
        sku: variant.sku,
        slug: product.slug,
        name: product.name,
        image: product.images[0]?.url ?? "",
        variantName: variant.name,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        maxQuantity: variant.inventoryQty,
      },
      1
    );
    toast.success("Đã thêm vào giỏ hàng");
  }

  return (
    <div className="flex flex-col gap-5">
      {product.variants.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">{product.optionName || "Phân loại"}</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.sku}
                onClick={() => setSelectedSku(v.sku)}
                disabled={v.inventoryQty === 0}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition",
                  v.sku === selectedSku ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/50",
                  v.inventoryQty === 0 && "cursor-not-allowed opacity-40 line-through"
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <h1 className="font-heading text-3xl font-medium">{product.name}</h1>

      <div>
        <p className="text-xs text-muted-foreground">Giá bán</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-heading text-2xl font-medium">{formatVnd(variant.price)}</span>
          {variant.compareAtPrice && (
            <span className="text-muted-foreground line-through">{formatVnd(variant.compareAtPrice)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className={cn("size-2 rounded-full", inStock ? "bg-emerald-500" : "bg-destructive")} />
        {inStock ? `Còn hàng (${variant.inventoryQty} sản phẩm)` : "Hết hàng"}
      </div>

      {product.reviewCount > 0 && (
        <p className="text-sm text-muted-foreground">
          ★ {product.ratingAverage.toFixed(1)} · {product.reviewCount} đánh giá
        </p>
      )}

      <Button size="lg" className="rounded-full" disabled={!inStock} onClick={handleAddToCart}>
        {inStock ? "Thêm vào giỏ hàng" : "Hết hàng"}
      </Button>

      <div className="flex flex-col gap-2.5 border-t border-border pt-4 text-sm text-foreground/80">
        <p className="flex items-center gap-2">
          <PackageCheck className="size-4 shrink-0 text-muted-foreground" /> Đổi trả trong 7 ngày nếu sản phẩm lỗi
        </p>
        <p className="flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-muted-foreground" /> Cam kết chất lượng thủy tinh cao cấp
        </p>
        <p className="flex items-center gap-2">
          <Truck className="size-4 shrink-0 text-muted-foreground" /> Miễn phí vận chuyển cho đơn từ 490.000đ
        </p>
      </div>
    </div>
  );
}
