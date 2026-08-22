"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { ApiClientError } from "@/lib/api/client";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { formatVnd, formatDateTime } from "@/lib/format";

const exportOptionsSchema = z.object({
  defaultWeightPerItemKg: z.coerce.number().min(0.01, "Phải lớn hơn 0").max(50),
  allowPartialDelivery: z.boolean(),
  allowTryOn: z.boolean(),
  allowViewNoTry: z.boolean(),
  highValueThreshold: z.coerce.number().min(0),
});
type ExportOptionsValues = z.infer<typeof exportOptionsSchema>;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminOrdersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", { q, page }],
    queryFn: () => adminApi.orders.list({ q: q || undefined, page, limit: 20 }),
  });

  // A changed search no longer describes what was selected before it — drop
  // the selection rather than silently exporting orders the admin can no
  // longer see.
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, [q]);

  const items = data?.items ?? [];
  const allOnPageSelected = items.length > 0 && items.every((o) => selectedIds.has(o._id));
  const selectionCount = selectAllMatching ? (data?.total ?? 0) : selectedIds.size;

  function togglePageSelection() {
    setSelectAllMatching(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        items.forEach((o) => next.delete(o._id));
      } else {
        items.forEach((o) => next.add(o._id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectAllMatching(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }

  const form = useForm<ExportOptionsValues>({
    resolver: zodResolver(exportOptionsSchema),
    defaultValues: {
      defaultWeightPerItemKg: 0.5,
      allowPartialDelivery: false,
      allowTryOn: false,
      allowViewNoTry: true,
      highValueThreshold: 3_000_000,
    },
  });

  const exportMutation = useMutation({
    mutationFn: (values: ExportOptionsValues) => {
      const payload = selectAllMatching
        ? { filters: { q: q || undefined }, options: values }
        : { orderIds: Array.from(selectedIds), options: values };
      return adminApi.orders.exportSpx(payload);
    },
    onSuccess: ({ blob, filename }) => {
      downloadBlob(blob, filename);
      toast.success("Đã xuất file Excel cho SPX");
      setExportOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Xuất file thất bại", { duration: 10000 });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Đơn hàng</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Tìm theo mã đơn, tên, email..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Button
            variant="outline"
            className="rounded-full"
            disabled={selectionCount === 0}
            onClick={() => setExportOpen(true)}
          >
            <FileSpreadsheet className="size-4" /> Xuất Excel SPX{selectionCount > 0 ? ` (${selectionCount})` : ""}
          </Button>
        </div>
      </div>

      {selectAllMatching ? (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm">
          Đã chọn tất cả <strong>{data?.total ?? 0}</strong> đơn phù hợp bộ lọc hiện tại.
          <button type="button" className="text-primary underline underline-offset-2" onClick={clearSelection}>
            Bỏ chọn
          </button>
        </div>
      ) : (
        selectedIds.size > 0 &&
        data &&
        data.total > items.length && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm">
            Đã chọn {selectedIds.size} đơn trên trang này.
            <button
              type="button"
              className="text-primary underline underline-offset-2"
              onClick={() => setSelectAllMatching(true)}
            >
              Chọn tất cả {data.total} đơn phù hợp bộ lọc
            </button>
            <button type="button" className="text-muted-foreground underline underline-offset-2" onClick={clearSelection}>
              Bỏ chọn
            </button>
          </div>
        )
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectAllMatching || allOnPageSelected}
                  onChange={togglePageSelection}
                  aria-label="Chọn tất cả trên trang này"
                />
              </th>
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Thanh toán</th>
              <th className="px-4 py-3">Đơn hàng</th>
              <th className="px-4 py-3">Vận chuyển</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3">Ngày đặt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((order) => (
              <tr key={order._id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectAllMatching || selectedIds.has(order._id)}
                    disabled={selectAllMatching}
                    onChange={() => toggleOne(order._id)}
                    aria-label={`Chọn đơn ${order.orderNumber}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/orders/${order._id}`} className="font-medium hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {order.customer?.name ?? "—"}
                  <br />
                  <span className="text-xs text-muted-foreground">{order.customer?.email ?? ""}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.orderStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.shippingStatus} />
                </td>
                <td className="px-4 py-3 text-right">{formatVnd(order.total)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Không có đơn hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-1.5 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex size-8 items-center justify-center rounded-full ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xuất Excel cho SPX ({selectionCount} đơn)</DialogTitle>
            <DialogDescription>
              File theo mẫu &quot;Tạo đơn (địa chỉ cũ)&quot; của SPX. Chỉ đơn đã thanh toán mới được xuất — vì đã thu
              tiền qua chuyển khoản nên Thu COD luôn để N.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => exportMutation.mutate(v))} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="defaultWeightPerItemKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cân nặng mỗi sản phẩm (KG)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="highValueThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngưỡng &quot;bưu gửi giá trị cao&quot; (VNĐ)</FormLabel>
                    <FormControl>
                      <Input type="number" step="100000" min="0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allowPartialDelivery"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                      Cho phép giao hàng một phần
                    </label>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allowTryOn"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                      Cho phép thử hàng
                    </label>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allowViewNoTry"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                      Cho xem hàng, không cho thử
                    </label>
                  </FormItem>
                )}
              />
              <Button type="submit" className="rounded-full" disabled={exportMutation.isPending}>
                {exportMutation.isPending ? "Đang tạo file..." : "Tải file Excel"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
