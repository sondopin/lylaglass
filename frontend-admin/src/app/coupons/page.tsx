"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { Coupon } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ApiClientError } from "@/lib/api/client";
import { formatVnd } from "@/lib/format";

const couponSchema = z.object({
  code: z.string().min(2, "Tối thiểu 2 ký tự"),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.coerce.number().min(0),
  minimumSubtotal: z.coerce.number().min(0).optional(),
  isActive: z.boolean(),
});
type CouponValues = z.infer<typeof couponSchema>;

const TYPE_LABEL: Record<string, string> = { percentage: "Giảm %", fixed: "Giảm tiền cố định", free_shipping: "Miễn phí ship" };

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => adminApi.coupons.list(),
  });

  const form = useForm<CouponValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: { code: "", type: "percentage", value: 10, minimumSubtotal: 0, isActive: true },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ code: "", type: "percentage", value: 10, minimumSubtotal: 0, isActive: true });
    setOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon);
    form.reset({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minimumSubtotal: coupon.minimumSubtotal ?? 0,
      isActive: coupon.isActive,
    });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: CouponValues) =>
      editing ? adminApi.coupons.update(editing._id, values) : adminApi.coupons.create(values),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật mã giảm giá" : "Đã tạo mã giảm giá");
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Có lỗi xảy ra"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.coupons.remove(id),
    onSuccess: () => {
      toast.success("Đã xoá mã giảm giá");
      queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-medium">Mã giảm giá</h1>
        <Button className="rounded-full" onClick={openCreate}>
          <Plus className="size-4" /> Thêm mã giảm giá
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Giá trị</th>
              <th className="px-4 py-3">Đơn tối thiểu</th>
              <th className="px-4 py-3">Đã dùng</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {coupons.map((c) => (
              <tr key={c._id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{c.code}</td>
                <td className="px-4 py-3">{TYPE_LABEL[c.type]}</td>
                <td className="px-4 py-3">{c.type === "percentage" ? `${c.value}%` : c.type === "fixed" ? formatVnd(c.value) : "—"}</td>
                <td className="px-4 py-3">{formatVnd(c.minimumSubtotal ?? 0)}</td>
                <td className="px-4 py-3">{c.usageCount}</td>
                <td className="px-4 py-3">
                  <span className={c.isActive ? "text-emerald-600" : "text-muted-foreground"}>{c.isActive ? "Đang hoạt động" : "Đã tắt"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} aria-label="Sửa">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (confirm(`Xoá mã "${c.code}"?`)) deleteMutation.mutate(c._id);
                      }}
                      aria-label="Xoá"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Chưa có mã giảm giá nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa mã giảm giá" : "Thêm mã giảm giá"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã</FormLabel>
                    <FormControl>
                      <Input {...field} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại giảm giá</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
                      >
                        <option value="percentage">Giảm theo %</option>
                        <option value="fixed">Giảm số tiền cố định</option>
                        <option value="free_shipping">Miễn phí vận chuyển</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Giá trị (% hoặc VNĐ)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minimumSubtotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đơn hàng tối thiểu (VNĐ)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                      Đang hoạt động
                    </label>
                  </FormItem>
                )}
              />
              <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
                {editing ? "Lưu thay đổi" : "Tạo mã giảm giá"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
