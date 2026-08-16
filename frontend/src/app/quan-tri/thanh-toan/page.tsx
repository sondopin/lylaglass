"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatVnd, formatDateTime } from "@/lib/format";

const PAYMENT_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "failed", label: "Thất bại" },
  { value: "refunded", label: "Đã hoàn tiền" },
];

export default function AdminPaymentsPage() {
  const token = useAdminAuthStore((s) => s.token);
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", status],
    queryFn: () => adminApi.orders.list(token!, { paymentStatus: status || undefined, limit: 50 }),
    enabled: !!token,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Thanh toán</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
        >
          {PAYMENT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Phương thức</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Số tiền</th>
              <th className="px-4 py-3">Ngày đặt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.items.map((order) => (
              <tr key={order._id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/quan-tri/don-hang/${order._id}`} className="font-medium hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{order.customer.name}</td>
                <td className="px-4 py-3 uppercase text-muted-foreground">{order.paymentMethod}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.paymentStatus} />
                </td>
                <td className="px-4 py-3 text-right">{formatVnd(order.total)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
              </tr>
            ))}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Không có giao dịch nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
