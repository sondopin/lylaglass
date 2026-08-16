"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { useAdminAuthStore } from "@/store/admin-auth-store";
import { Input } from "@/components/ui/input";
import { formatVnd, formatDate } from "@/lib/format";

export default function AdminCustomersPage() {
  const token = useAdminAuthStore((s) => s.token);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customers", q],
    queryFn: () => adminApi.customers.list(token!, { q: q || undefined, limit: 50 }),
    enabled: !!token,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-medium">Khách hàng</h1>
        <Input placeholder="Tìm theo tên, email..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Điện thoại</th>
              <th className="px-4 py-3">Số đơn hàng</th>
              <th className="px-4 py-3">Tổng chi tiêu</th>
              <th className="px-4 py-3">Khách hàng từ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.items.map((c) => (
              <tr key={c._id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                <td className="px-4 py-3">{c.ordersCount}</td>
                <td className="px-4 py-3">{formatVnd(c.totalSpent)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Chưa có khách hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
