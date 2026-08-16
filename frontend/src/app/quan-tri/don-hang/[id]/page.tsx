"use client";

import { use, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatVnd, formatDateTime } from "@/lib/format";
import { ApiClientError } from "@/lib/api/client";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "completed", "cancelled"];
const SHIPPING_STATUSES = ["unfulfilled", "processing", "shipped", "delivered", "returned"];

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const token = useAdminAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin", "orders", id],
    queryFn: () => adminApi.orders.get(token!, id),
    enabled: !!token,
  });

  const updateStatus = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminApi.orders.updateStatus(token!, id, body),
    onSuccess: () => {
      toast.success("Đã cập nhật đơn hàng");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Có lỗi xảy ra"),
  });

  const cancelOrder = useMutation({
    mutationFn: () => adminApi.orders.cancel(token!, id),
    onSuccess: () => {
      toast.success("Đã huỷ đơn hàng, tồn kho đã được hoàn lại");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", id] });
    },
  });

  if (isLoading || !order) return <p className="text-sm text-muted-foreground">Đang tải...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium">Đơn hàng {order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">Đặt lúc {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={order.paymentStatus} />
          <StatusBadge status={order.orderStatus} />
          <StatusBadge status={order.shippingStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 font-heading text-lg font-medium">Sản phẩm</h2>
            <ul className="flex flex-col divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.sku} className="flex items-center gap-3 py-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image && <Image src={item.image} alt={item.productName} fill sizes="56px" className="object-cover" />}
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variantName} · SKU {item.sku} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{formatVnd(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 ml-auto flex max-w-xs flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Tạm tính</span>
                <span>{formatVnd(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Giảm giá</span>
                <span>-{formatVnd(order.discountTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Phí vận chuyển</span>
                <span>{formatVnd(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                <span>Tổng cộng</span>
                <span>{formatVnd(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 font-heading text-lg font-medium">Khách hàng & Giao hàng</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Khách hàng</p>
                <p>{order.customer.name}</p>
                <p className="text-muted-foreground">{order.customer.email}</p>
                <p className="text-muted-foreground">{order.customer.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Địa chỉ giao hàng</p>
                <p>{order.shippingAddress.fullName}</p>
                <p className="text-muted-foreground">
                  {[order.shippingAddress.line1, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.province]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
            {order.customerNote && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Ghi chú của khách</p>
                <p className="text-sm">{order.customerNote}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border p-5">
            <h2 className="mb-3 font-heading text-lg font-medium">Cập nhật trạng thái</h2>
            <div className="flex flex-col gap-3 text-sm">
              <label className="flex flex-col gap-1">
                Trạng thái đơn hàng
                <select
                  defaultValue={order.orderStatus}
                  onChange={(e) => updateStatus.mutate({ orderStatus: e.target.value })}
                  className="rounded-lg border border-input bg-transparent px-3 py-2 outline-none focus-visible:border-ring"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Trạng thái vận chuyển
                <select
                  defaultValue={order.shippingStatus}
                  onChange={(e) => updateStatus.mutate({ shippingStatus: e.target.value })}
                  className="rounded-lg border border-input bg-transparent px-3 py-2 outline-none focus-visible:border-ring"
                >
                  {SHIPPING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                Mã vận đơn
                <Input
                  defaultValue={order.trackingNumber}
                  placeholder="Nhập mã vận đơn"
                  onChange={(e) => setTracking(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                Đơn vị vận chuyển
                <Input
                  defaultValue={order.shippingCarrier}
                  placeholder="VD: Giao Hàng Nhanh"
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </label>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => updateStatus.mutate({ trackingNumber: tracking, shippingCarrier: carrier })}
              >
                Lưu thông tin vận chuyển
              </Button>

              {order.orderStatus !== "cancelled" && order.orderStatus !== "completed" && (
                <Button
                  variant="destructive"
                  className="rounded-full"
                  onClick={() => {
                    if (confirm("Huỷ đơn hàng này? Tồn kho sẽ được hoàn lại.")) cancelOrder.mutate();
                  }}
                >
                  Huỷ đơn hàng
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
