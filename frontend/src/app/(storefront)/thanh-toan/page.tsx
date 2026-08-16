"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCartStore, cartSubtotal } from "@/store/cart-store";
import { formatVnd } from "@/lib/format";
import { checkoutApi } from "@/lib/api/checkout";
import { couponsApi, CouponEvaluation } from "@/lib/api/coupons";
import { ApiClientError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const checkoutSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập họ tên"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().min(9, "Số điện thoại không hợp lệ"),
  line1: z.string().min(1, "Vui lòng nhập địa chỉ"),
  line2: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  province: z.string().min(1, "Vui lòng nhập tỉnh/thành phố"),
  customerNote: z.string().optional(),
  paymentMethod: z.enum(["cod", "mock"]),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const subtotal = cartSubtotal(items);

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<CouponEvaluation | null>(null);
  const [couponError, setCouponError] = useState("");

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      line1: "",
      line2: "",
      ward: "",
      district: "",
      province: "",
      customerNote: "",
      paymentMethod: "cod",
    },
  });

  const applyCoupon = useMutation({
    mutationFn: () => couponsApi.validate(couponCode.trim(), subtotal),
    onSuccess: (data) => {
      setCoupon(data);
      setCouponError("");
      toast.success("Áp dụng mã giảm giá thành công");
    },
    onError: (err) => {
      setCoupon(null);
      setCouponError(err instanceof ApiClientError ? err.message : "Mã giảm giá không hợp lệ");
    },
  });

  const submitOrder = useMutation({
    mutationFn: (values: CheckoutValues) =>
      checkoutApi.submit({
        customer: { name: values.name, email: values.email, phone: values.phone },
        shippingAddress: {
          fullName: values.name,
          phone: values.phone,
          line1: values.line1,
          line2: values.line2,
          ward: values.ward,
          district: values.district,
          province: values.province,
        },
        items: items.map((i) => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })),
        couponCode: coupon?.code,
        customerNote: values.customerNote,
        paymentMethod: values.paymentMethod,
      }),
    onSuccess: (result) => {
      clear();
      if (result.redirectUrl) {
        const sep = result.redirectUrl.includes("?") ? "&" : "?";
        router.push(`${result.redirectUrl}${sep}email=${encodeURIComponent(result.order.customer.email)}`);
      } else {
        router.push(`/don-hang/${result.order.orderNumber}?email=${encodeURIComponent(result.order.customer.email)}`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Đặt hàng thất bại, vui lòng thử lại");
    },
  });

  const discount = coupon?.discountTotal ?? 0;

  if (items.length === 0) {
    return (
      <div className="container-lyla flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-muted-foreground">Giỏ hàng đang trống, không thể thanh toán.</p>
        <Button className="rounded-full" render={<Link href="/san-pham" />}>
          Khám phá sản phẩm
        </Button>
      </div>
    );
  }

  return (
    <div className="container-lyla py-10">
      <h1 className="mb-8 font-heading text-3xl font-medium">Thanh toán</h1>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.3fr_1fr]">
        <Form {...form}>
          <form
            id="checkout-form"
            onSubmit={form.handleSubmit((v) => submitOrder.mutate(v))}
            className="flex flex-col gap-8"
          >
            <section>
              <h2 className="mb-4 font-heading text-lg font-medium">Thông tin liên hệ</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Họ và tên</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số điện thoại</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-4 font-heading text-lg font-medium">Địa chỉ giao hàng</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="line1"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Địa chỉ (số nhà, đường)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="line2"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Địa chỉ bổ sung (không bắt buộc)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ward"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phường/Xã</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quận/Huyện</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tỉnh/Thành phố</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-4 font-heading text-lg font-medium">Ghi chú đơn hàng</h2>
              <FormField
                control={form.control}
                name="customerNote"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea rows={3} placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>

            <section>
              <h2 className="mb-4 font-heading text-lg font-medium">Phương thức thanh toán</h2>
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        {[
                          { value: "cod", label: "Thanh toán khi nhận hàng (COD)" },
                          { value: "mock", label: "Thanh toán online (thẻ / ví điện tử)" },
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm",
                              field.value === opt.value && "border-foreground"
                            )}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={opt.value}
                              checked={field.value === opt.value}
                              onChange={() => field.onChange(opt.value)}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>
          </form>
        </Form>

        <aside className="h-fit rounded-2xl bg-mint-light p-6">
          <h2 className="font-heading text-lg font-medium">Đơn hàng của bạn</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.sku} className="flex gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-background">
                  {item.image && <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />}
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                    {item.quantity}
                  </span>
                </div>
                <div className="flex-1 text-sm">
                  <p className="line-clamp-1 font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.variantName}</p>
                </div>
                <p className="text-sm font-medium">{formatVnd(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex gap-2">
            <Input
              placeholder="Mã giảm giá"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="bg-background"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-full"
              disabled={!couponCode || applyCoupon.isPending}
              onClick={() => applyCoupon.mutate()}
            >
              Áp dụng
            </Button>
          </div>
          {couponError && <p className="mt-1 text-xs text-destructive">{couponError}</p>}
          {coupon && <p className="mt-1 text-xs text-emerald-600">Đã áp dụng mã {coupon.code}</p>}

          <div className="mt-5 flex flex-col gap-2 border-t border-border/60 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tạm tính</span>
              <span>{formatVnd(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Giảm giá</span>
                <span>-{formatVnd(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Phí vận chuyển</span>
              <span>Tính khi đặt hàng</span>
            </div>
          </div>

          <Button
            type="submit"
            form="checkout-form"
            size="lg"
            className="mt-5 w-full rounded-full"
            disabled={submitOrder.isPending}
          >
            {submitOrder.isPending ? "Đang xử lý..." : "Đặt hàng"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
