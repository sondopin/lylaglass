import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  // order status
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
  // payment
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-slate-200 text-slate-800",
  // shipping
  unfulfilled: "bg-amber-100 text-amber-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800",
  returned: "bg-red-100 text-red-800",
};

const LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
  unfulfilled: "Chưa giao",
  shipped: "Đang giao",
  delivered: "Đã giao",
  returned: "Đã hoàn trả",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", TONE[status] ?? "bg-muted text-foreground")}>
      {LABEL[status] ?? status}
    </span>
  );
}
