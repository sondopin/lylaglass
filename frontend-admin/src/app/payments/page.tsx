"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/admin";
import { StatusBadge } from "@/components/status-badge";
import { formatVnd, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAYMENT_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "failed", label: "Thất bại" },
  { value: "refunded", label: "Đã hoàn tiền" },
];

const MATCH_FILTERS = [
  { value: "", label: "Tất cả giao dịch" },
  { value: "matched", label: "Đã khớp đơn" },
  { value: "rejected", label: "Bị từ chối" },
  { value: "unmatched", label: "Không khớp đơn" },
  { value: "ignored", label: "Bỏ qua" },
];

const MATCH_TONE: Record<string, string> = {
  matched: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  unmatched: "bg-amber-100 text-amber-800",
  ignored: "bg-slate-200 text-slate-800",
};

const MATCH_LABEL: Record<string, string> = {
  matched: "Đã khớp đơn",
  rejected: "Bị từ chối",
  unmatched: "Không khớp đơn",
  ignored: "Bỏ qua",
};

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState("");
  const [matchStatus, setMatchStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", status],
    queryFn: () => adminApi.orders.list({ paymentStatus: status || undefined, limit: 50 }),
  });

  // Incoming transfers reported by the bank notification provider, including the
  // ones that matched no order or were rejected — the reconciliation worklist.
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["admin", "bank-transactions", matchStatus],
    queryFn: () => adminApi.bankTransactions.list({ matchStatus: matchStatus || undefined, limit: 50 }),
  });

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-medium">Thanh toán</h1>
            <p className="text-sm text-muted-foreground">
              Toàn bộ đơn hàng thanh toán bằng chuyển khoản VietQR (TPBank). Trạng thái được xác nhận tự động từ giao
              dịch tiền vào.
            </p>
          </div>
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
                    <Link href={`/orders/${order._id}`} className="font-medium hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">VietQR / Chuyển khoản</td>
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
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-medium">Giao dịch ngân hàng nhận được</h2>
            <p className="text-sm text-muted-foreground">
              Mọi thông báo tiền vào từ SePay. Giao dịch &quot;Bị từ chối&quot; hoặc &quot;Không khớp đơn&quot; cần đối
              soát thủ công (sai số tiền, sai nội dung, hoặc chuyển sau khi đơn đã hết hạn).
            </p>
          </div>
          <select
            value={matchStatus}
            onChange={(e) => setMatchStatus(e.target.value)}
            className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
          >
            {MATCH_FILTERS.map((f) => (
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
                <th className="px-4 py-3">Mã GD</th>
                <th className="px-4 py-3">Ngân hàng</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3">Kết quả đối soát</th>
                <th className="px-4 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions?.items.map((tx) => (
                <tr key={tx._id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{tx.providerTransactionId}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tx.gateway}
                    <span className="block text-xs">{tx.accountNumber}</span>
                  </td>
                  <td className="max-w-[260px] px-4 py-3">
                    <span className="block truncate">{tx.content || "—"}</span>
                    {tx.code && <span className="text-xs text-muted-foreground">Mã: {tx.code}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tx.transferType === "in" ? "+" : "−"}
                    {formatVnd(tx.transferAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        MATCH_TONE[tx.matchStatus] ?? "bg-muted text-foreground"
                      )}
                    >
                      {MATCH_LABEL[tx.matchStatus] ?? tx.matchStatus}
                    </span>
                    {tx.matchNote && <span className="block text-xs text-muted-foreground">{tx.matchNote}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tx.transactionDate ? formatDateTime(tx.transactionDate) : formatDateTime(tx.createdAt)}
                  </td>
                </tr>
              ))}
              {!isLoadingTransactions && transactions?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Chưa nhận được giao dịch nào từ ngân hàng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
