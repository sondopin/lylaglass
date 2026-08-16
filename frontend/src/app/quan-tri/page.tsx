"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatVnd, formatDateTime } from "@/lib/format";

export default function AdminDashboardPage() {
  const token = useAdminAuthStore((s) => s.token);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminApi.dashboard(token!),
    enabled: !!token,
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Đang tải...</p>;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-2xl font-medium">Tổng quan</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tổng doanh thu" value={formatVnd(data.totalRevenue)} hint="Đơn đã thanh toán" />
        <StatCard label="Tổng đơn hàng" value={String(data.totalOrders)} hint={`${data.pendingOrders} đơn chờ xử lý`} />
        <StatCard label="Sản phẩm" value={String(data.totalProducts)} hint={`${data.lowStockCount} sản phẩm sắp hết hàng`} />
        <StatCard label="Khách hàng" value={String(data.totalCustomers)} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-medium">Đơn hàng gần đây</h2>
          <Link href="/quan-tri/don-hang" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            Xem tất cả
          </Link>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Thanh toán</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recentOrders.map((order) => (
                <tr key={order._id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/quan-tri/don-hang/${order._id}`} className="font-medium hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.customer.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.paymentStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.orderStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">{formatVnd(order.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Chưa có đơn hàng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
