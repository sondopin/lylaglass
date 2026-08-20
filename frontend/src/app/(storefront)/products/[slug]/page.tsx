import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productsApi } from "@/lib/api/products";
import { reviewsApi } from "@/lib/api/reviews";
import { ApiClientError } from "@/lib/api/client";
import { ProductGallery } from "@/components/product-detail/product-gallery";
import { PurchasePanel } from "@/components/product-detail/purchase-panel";
import { DetailsAccordion } from "@/components/product-detail/details-accordion";
import { ReviewsSection } from "@/components/product-detail/reviews-section";
import { ProductGrid } from "@/components/product/product-grid";

type Params = Promise<{ slug: string }>;

/**
 * Deduplicates the product lookup across `generateMetadata` and the page body,
 * which Next.js runs as two separate calls for the same request. Without this
 * the same product is fetched twice per render.
 */
const loadProduct = cache(async (slug: string) => {
  try {
    return await productsApi.getBySlug(slug);
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) notFound();
    throw err;
  }
});

/**
 * Reviews are fetched by product id, so they genuinely cannot be requested in
 * parallel with the product — the id is only known once the product arrives.
 *
 * Rather than making the whole page wait for that second round trip, the
 * reviews render as their own streamed segment: the gallery, price and
 * add-to-cart button reach the browser as soon as the product does, and the
 * reviews fill in a moment later.
 */
async function ReviewsPanel({ productId }: { productId: string }) {
  const { reviews, summary } = await reviewsApi
    .listForProduct(productId)
    .catch(() => ({ reviews: [], summary: { average: 0, count: 0 } }));

  return <ReviewsSection productId={productId} reviews={reviews} summary={summary} />;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { product } = await loadProduct(slug);
    const image = product.images[0]?.url;
    return {
      title: product.seoTitle || product.name,
      description: product.seoDescription || product.shortDescription,
      alternates: { canonical: `/products/${product.slug}` },
      openGraph: {
        title: product.name,
        description: product.shortDescription,
        images: image ? [image] : undefined,
        type: "website",
      },
    };
  } catch {
    return {};
  }
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { product, related } = await loadProduct(slug);

  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const inStock = product.variants.some((v) => v.inventoryQty > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.images.map((i) => i.url),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: "LylaGlass" },
    // Taken from the denormalised counters on the product rather than from the
    // reviews response — that is exactly what they exist for, and it keeps the
    // structured data out of the reviews request's critical path.
    aggregateRating:
      product.reviewCount > 0
        ? { "@type": "AggregateRating", ratingValue: product.ratingAverage, reviewCount: product.reviewCount }
        : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: minPrice,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/products/${product.slug}`,
    },
  };

  return (
    <div className="container-lyla py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} productName={product.name} />
        <PurchasePanel product={product} />
      </div>

      <div className="mx-auto mt-16 max-w-2xl">
        <DetailsAccordion product={product} />
      </div>

      <div className="mx-auto max-w-2xl">
        <Suspense
          fallback={
            <div className="py-10 text-sm text-muted-foreground">Đang tải đánh giá...</div>
          }
        >
          <ReviewsPanel productId={product._id} />
        </Suspense>
      </div>

      {related.length > 0 && (
        <section className="mt-20 border-t border-border pt-14">
          <h2 className="mb-8 font-heading text-2xl font-medium">Có thể bạn cũng thích</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
