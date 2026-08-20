"use client";

import { ProductForm } from "@/components/product-form";

export default function AdminNewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-medium">Thêm sản phẩm</h1>
      <ProductForm />
    </div>
  );
}
