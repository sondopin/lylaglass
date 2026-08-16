"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/lib/api/types";

export function ProductGallery({ images, productName }: { images: ProductImage[]; productName: string }) {
  const [active, setActive] = useState(0);
  const gallery = images.length > 0 ? images : [{ url: "", alt: productName }];

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {gallery.length > 1 && (
        <div className="flex gap-2 sm:flex-col">
          {gallery.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-border transition",
                active === i && "ring-2 ring-primary"
              )}
              aria-label={`Xem ảnh ${i + 1}`}
            >
              {img.url && <Image src={img.url} alt={img.alt || productName} fill sizes="64px" className="object-cover" />}
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-square flex-1 overflow-hidden rounded-2xl bg-muted">
        {gallery[active]?.url && (
          <Image
            src={gallery[active].url}
            alt={gallery[active].alt || productName}
            fill
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-cover"
          />
        )}
      </div>
    </div>
  );
}
