"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Product } from "@/lib/api/types";
import { formatVnd, discountPercent } from "@/lib/format";
import { useCartStore } from "@/store/cart-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const image = product.images[0];
  const hasSingleVariant = product.variants.length === 1;
  const variant = product.variants[0];

  const prices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const isRange = minPrice !== maxPrice;
  const percentOff = hasSingleVariant ? discountPercent(variant.price, variant.compareAtPrice) : null;
  const inStock = product.variants.some((v) => v.inventoryQty > 0);

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (!variant || variant.inventoryQty <= 0) return;
    addItem(
      {
        productId: product._id,
        sku: variant.sku,
        slug: product.slug,
        name: product.name,
        image: image?.url ?? "",
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
    <Link href={`/products/${product.slug}`} className="group flex flex-col text-left">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        {image && (
          <Image
            src={image.url}
            alt={image.alt || product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}

        {percentOff !== null && (
          <span className="absolute left-3 top-3 rounded-full bg-coral px-2.5 py-1 text-xs font-semibold text-white">
            -{percentOff}%
          </span>
        )}
        {!inStock && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-background">
            Hết hàng
          </span>
        )}

        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          {hasSingleVariant ? (
            <Button
              size="sm"
              className="w-full rounded-full shadow-md"
              onClick={handleQuickAdd}
              disabled={!inStock}
            >
              {inStock ? "Thêm vào giỏ" : "Hết hàng"}
            </Button>
          ) : (
            <span className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "w-full rounded-full shadow-md")}>
              Chọn phân loại
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">LylaGlass</p>
      <h3 className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground decoration-1 underline-offset-2 group-hover:underline">
        {product.name}
      </h3>
      <div className="mt-1 flex items-center gap-2 text-sm">
        {hasSingleVariant ? (
          <>
            <span className="font-semibold text-foreground">{formatVnd(variant.price)}</span>
            {variant.compareAtPrice && (
              <span className="text-muted-foreground line-through">{formatVnd(variant.compareAtPrice)}</span>
            )}
          </>
        ) : (
          <span className="font-semibold text-foreground">{isRange ? `Từ ${formatVnd(minPrice)}` : formatVnd(minPrice)}</span>
        )}
      </div>
    </Link>
  );
}
