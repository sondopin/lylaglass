import type { Metadata } from "next";
import { productsApi, ProductListFilters } from "@/lib/api/products";
import { SortSelect } from "@/components/product/sort-select";
import { ProductGrid } from "@/components/product/product-grid";
import { PaginationControls } from "@/components/product/pagination-controls";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export const metadata: Metadata = {
  title: "Tất cả sản phẩm",
  description: "Toàn bộ bộ sưu tập ly thủy tinh LylaGlass — quà tặng, theo mùa và dùng mỗi ngày.",
  alternates: { canonical: "/san-pham" },
};

export default async function AllProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const sort = (sp.sort as ProductListFilters["sort"]) ?? "featured";

  const { items, total, totalPages } = await productsApi.list({ page, sort, limit: 12 });

  return (
    <>
      <div className="bg-rose-deep/10 py-12 text-center sm:py-16">
        <h1 className="font-heading text-3xl font-medium sm:text-4xl">Tất cả sản phẩm</h1>
        <p className="mt-2 text-sm text-muted-foreground">{total} sản phẩm trong bộ sưu tập LylaGlass</p>
      </div>
      <div className="container-lyla py-10">
        <div className="mb-8 flex items-center justify-end">
          <SortSelect current={sort} />
        </div>
        <ProductGrid products={items} />
        <PaginationControls basePath="/san-pham" currentSearchParams={{ sort: sp.sort as string }} page={page} totalPages={totalPages} />
      </div>
    </>
  );
}
