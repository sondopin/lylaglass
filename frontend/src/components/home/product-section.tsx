import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/product-grid";
import { Reveal } from "@/components/reveal";
import { Product } from "@/lib/api/types";

export function ProductSection({
  heading,
  subheading,
  products,
  viewMoreHref,
}: {
  heading: string;
  subheading: string;
  products: Product[];
  viewMoreHref: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="container-lyla py-16 sm:py-20">
      <Reveal className="mx-auto mb-10 max-w-xl text-center">
        <h2 className="font-heading text-3xl font-medium sm:text-4xl">{heading}</h2>
        <p className="mt-2 font-heading text-base italic text-muted-foreground">{subheading}</p>
      </Reveal>

      <ProductGrid products={products} />

      <div className="mt-12 flex justify-center">
        <Button variant="outline" className="rounded-full px-8" render={<Link href={viewMoreHref} />}>
          Xem thêm
        </Button>
      </div>
    </section>
  );
}
