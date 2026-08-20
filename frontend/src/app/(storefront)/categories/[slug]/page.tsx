import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoriesApi } from "@/lib/api/categories";
import { productsApi, ProductListFilters } from "@/lib/api/products";
import { ApiClientError } from "@/lib/api/client";
import { CollectionBanner } from "@/components/product/collection-banner";
import { SortSelect } from "@/components/product/sort-select";
import { ProductGrid } from "@/components/product/product-grid";
import { PaginationControls } from "@/components/product/pagination-controls";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Deduplicates the category lookup across `generateMetadata` and the page body,
 * which Next.js runs as two separate calls for the same request. Without this
 * the same category is fetched twice per render.
 */
const loadCategory = cache((slug: string) => categoriesApi.getBySlug(slug));

export async function generateStaticParams() {
  const categories = await categoriesApi.list().catch(() => []);
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const category = await loadCategory((await params).slug);
    return {
      title: category.seoTitle || category.name,
      description: category.seoDescription || category.description,
      alternates: { canonical: `/categories/${category.slug}` },
      openGraph: { title: category.name, description: category.description, images: category.image ? [category.image] : undefined },
    };
  } catch {
    return {};
  }
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  const page = Number(sp.page ?? 1) || 1;
  const sort = (sp.sort as ProductListFilters["sort"]) ?? "featured";

  // The product list is filtered by category *slug*, not by the category's id,
  // so it does not depend on the category lookup — the two requests are issued
  // together instead of one after the other.
  const [category, productPage] = await Promise.all([
    loadCategory(slug).catch((err) => {
      if (err instanceof ApiClientError && err.status === 404) notFound();
      throw err;
    }),
    productsApi.list({ category: slug, page, sort, limit: 12 }),
  ]);

  const { items, total, totalPages } = productPage;

  return (
    <>
      <CollectionBanner title={category.name} description={category.description} image={category.image} itemCount={total} />
      <div className="container-lyla py-10">
        <div className="mb-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} sản phẩm</p>
          <SortSelect current={sort} />
        </div>
        <ProductGrid products={items} />
        <PaginationControls
          basePath={`/categories/${slug}`}
          currentSearchParams={{ sort: sp.sort as string }}
          page={page}
          totalPages={totalPages}
        />
      </div>
    </>
  );
}
