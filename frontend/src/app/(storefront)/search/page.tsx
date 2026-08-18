import type { Metadata } from "next";
import { productsApi } from "@/lib/api/products";
import { ProductGrid } from "@/components/product/product-grid";
import { PaginationControls } from "@/components/product/pagination-controls";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = ((await searchParams).q as string) ?? "";
  return { title: q ? `Kết quả tìm kiếm cho "${q}"` : "Tìm kiếm", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (sp.q as string) ?? "";
  const page = Number(sp.page ?? 1) || 1;

  const { items, total, totalPages } = q ? await productsApi.list({ q, page, limit: 12 }) : { items: [], total: 0, totalPages: 1 };

  return (
    <div className="container-lyla py-10">
      <h1 className="font-heading text-2xl font-medium">
        {q ? (
          <>
            {total} kết quả cho &quot;{q}&quot;
          </>
        ) : (
          "Nhập từ khoá để tìm kiếm"
        )}
      </h1>
      <div className="mt-8">
        <ProductGrid products={items} emptyMessage="Thử tìm với từ khoá khác, ví dụ: ly, quà tặng, thuỷ tinh..." />
      </div>
      <PaginationControls basePath="/search" currentSearchParams={{ q }} page={page} totalPages={totalPages} />
    </div>
  );
}
