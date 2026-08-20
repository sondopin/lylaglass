"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { ProductForm } from "@/components/product-form";

export default function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: product, isLoading } = useQuery({
    queryKey: ["admin", "products", id],
    queryFn: () => adminApi.products.get(id),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-medium">Sửa sản phẩm</h1>
      {isLoading || !product ? <p className="text-sm text-muted-foreground">Đang tải...</p> : <ProductForm product={product} />}
    </div>
  );
}
