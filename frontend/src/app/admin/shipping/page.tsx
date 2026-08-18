"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsApi } from "@/lib/api/settings";
import { adminApi } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";

const shippingSchema = z.object({
  freeShippingThreshold: z.coerce.number().min(0),
  flatShippingFee: z.coerce.number().min(0),
});
type ShippingValues = z.infer<typeof shippingSchema>;

export default function AdminShippingPage() {
  const token = useAdminAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => settingsApi.get() });

  const form = useForm<ShippingValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: { freeShippingThreshold: 490000, flatShippingFee: 30000 },
  });

  useEffect(() => {
    if (settings) form.reset({ freeShippingThreshold: settings.freeShippingThreshold, flatShippingFee: settings.flatShippingFee });
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (values: ShippingValues) => adminApi.settings.update(token!, values),
    onSuccess: () => {
      toast.success("Đã cập nhật cấu hình vận chuyển");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="font-heading text-2xl font-medium">Vận chuyển</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-5 rounded-2xl border border-border p-6">
          <FormField
            control={form.control}
            name="freeShippingThreshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngưỡng miễn phí vận chuyển (VNĐ)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>Đơn hàng có tạm tính từ mức này trở lên sẽ được miễn phí vận chuyển.</FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="flatShippingFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phí vận chuyển đồng giá (VNĐ)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>Áp dụng cho đơn hàng chưa đạt ngưỡng miễn phí vận chuyển.</FormDescription>
              </FormItem>
            )}
          />
          <Button type="submit" className="rounded-full" disabled={saveMutation.isPending}>
            Lưu thay đổi
          </Button>
        </form>
      </Form>
    </div>
  );
}
