import { Product } from "@/lib/api/types";
import { ProductCard } from "./product-card";
import { RevealStagger } from "@/components/reveal";

export function ProductGrid({ products, emptyMessage }: { products: Product[]; emptyMessage?: string }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
        <p className="font-heading text-xl text-foreground">Không tìm thấy sản phẩm nào</p>
        <p className="text-sm">{emptyMessage ?? "Hãy thử điều chỉnh bộ lọc hoặc từ khoá tìm kiếm."}</p>
      </div>
    );
  }

  return (
    <RevealStagger className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </RevealStagger>
  );
}
