"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminInventoryPage() {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", "inventory"],
    queryFn: () => adminApi.products.list({ limit: 100 }),
  });

  const updateInventory = useMutation({
    mutationFn: ({ productId, sku, inventoryQty }: { productId: string; sku: string; inventoryQty: number }) =>
      adminApi.products.updateInventory(productId, sku, inventoryQty),
    onSuccess: () => {
      toast.success("Đã cập nhật tồn kho");
      queryClient.invalidateQueries({ queryKey: ["admin", "products", "inventory"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-medium">Tồn kho</h1>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Biến thể</th>
              <th className="px-4 py-3">Tồn kho hiện tại</th>
              <th className="px-4 py-3">Cập nhật</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.items.flatMap((product) =>
              product.variants.map((variant) => {
                const key = `${product._id}:${variant.sku}`;
                const isLow = variant.inventoryQty <= 5;
                return (
                  <tr key={key} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{variant.sku}</td>
                    <td className="px-4 py-3 text-muted-foreground">{variant.name}</td>
                    <td className="px-4 py-3">
                      <span className={isLow ? "font-medium text-destructive" : ""}>{variant.inventoryQty}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min={0}
                        defaultValue={variant.inventoryQty}
                        className="w-24"
                        onChange={(e) => setEdits((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={edits[key] === undefined || updateInventory.isPending}
                        onClick={() => updateInventory.mutate({ productId: product._id, sku: variant.sku, inventoryQty: edits[key] })}
                      >
                        Lưu
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
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
