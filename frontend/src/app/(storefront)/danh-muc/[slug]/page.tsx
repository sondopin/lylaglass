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

export async function generateStaticParams() {
  const categories = await categoriesApi.list().catch(() => []);
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const category = await categoriesApi.getBySlug((await params).slug);
    return {
      title: category.seoTitle || category.name,
      description: category.seoDescription || category.description,
      alternates: { canonical: `/danh-muc/${category.slug}` },
      openGraph: { title: category.name, description: category.description, images: category.image ? [category.image] : undefined },
    };
  } catch {
    return {};
  }
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;

  let category;
  try {
    category = await categoriesApi.getBySlug(slug);
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) notFound();
    throw err;
  }

  const page = Number(sp.page ?? 1) || 1;
  const sort = (sp.sort as ProductListFilters["sort"]) ?? "featured";

  const { items, total, totalPages } = await productsApi.list({ category: slug, page, sort, limit: 12 });

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
          basePath={`/danh-muc/${slug}`}
          currentSearchParams={{ sort: sp.sort as string }}
          page={page}
          totalPages={totalPages}
        />
      </div>
    </>
  );
}
