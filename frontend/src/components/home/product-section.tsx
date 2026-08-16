import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
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
      <div className="mx-auto mb-10 max-w-xl text-center">
        <h2 className="font-heading text-3xl font-medium sm:text-4xl">{heading}</h2>
        <p className="mt-2 font-heading text-base italic text-muted-foreground">{subheading}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Button variant="outline" className="rounded-full px-8" render={<Link href={viewMoreHref} />}>
          Xem thêm
        </Button>
      </div>
    </section>
  );
}
