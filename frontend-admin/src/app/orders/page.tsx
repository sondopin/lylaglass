"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { formatVnd, formatDateTime } from "@/lib/format";

export default function AdminOrdersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", { q, page }],
    queryFn: () => adminApi.orders.list({ q: q || undefined, page, limit: 20 }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Đơn hàng</h1>
        <Input
          placeholder="Tìm theo mã đơn, tên, email..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
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
            {data?.items.map((order) => (
              <tr key={order._id} className="hover:bg-muted/30">
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
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
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
    </div>
  );
}
