"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatVnd } from "@/lib/format";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", q],
    queryFn: () => adminApi.products.list({ q: q || undefined, limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.products.remove(id),
    onSuccess: () => {
      toast.success("Đã xoá sản phẩm");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Sản phẩm</h1>
        <div className="flex gap-3">
          <Input placeholder="Tìm sản phẩm..." value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button className="rounded-full" render={<Link href="/products/new" />}>
            <Plus className="size-4" /> Thêm sản phẩm
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3">Danh mục</th>
              <th className="px-4 py-3">Giá</th>
              <th className="px-4 py-3">Tồn kho</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.items.map((p) => (
              <tr key={p._id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.images[0] && <Image src={p.images[0].url} alt={p.name} fill sizes="40px" className="object-cover" />}
                    </div>
                    <Link href={`/products/${p._id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {typeof p.categoryId === "object" ? p.categoryId.name : ""}
                </td>
                <td className="px-4 py-3">{formatVnd(p.minPrice ?? p.variants[0]?.price ?? 0)}</td>
                <td className="px-4 py-3">{p.totalInventory ?? p.variants.reduce((s, v) => s + v.inventoryQty, 0)}</td>
                <td className="px-4 py-3">
                  <span className={p.status === "active" ? "text-emerald-600" : "text-muted-foreground"}>
                    {p.status === "active" ? "Đang bán" : p.status === "draft" ? "Bản nháp" : "Ngừng bán"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon-sm" render={<Link href={`/products/${p._id}`} />} aria-label="Sửa">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm(`Xoá sản phẩm "${p.name}"?`)) deleteMutation.mutate(p._id);
                      }}
                      aria-label="Xoá"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Chưa có sản phẩm nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
