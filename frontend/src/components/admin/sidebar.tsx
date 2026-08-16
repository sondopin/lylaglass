"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  Boxes,
  TicketPercent,
  CreditCard,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/quan-tri", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/quan-tri/san-pham", label: "Sản phẩm", icon: Package },
  { href: "/quan-tri/danh-muc", label: "Danh mục", icon: FolderTree },
  { href: "/quan-tri/don-hang", label: "Đơn hàng", icon: ShoppingCart },
  { href: "/quan-tri/khach-hang", label: "Khách hàng", icon: Users },
  { href: "/quan-tri/ton-kho", label: "Tồn kho", icon: Boxes },
  { href: "/quan-tri/ma-giam-gia", label: "Mã giảm giá", icon: TicketPercent },
  { href: "/quan-tri/thanh-toan", label: "Thanh toán", icon: CreditCard },
  { href: "/quan-tri/van-chuyen", label: "Vận chuyển", icon: Truck },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-background lg:block">
      <div className="flex h-16 items-center px-6 font-heading text-lg font-semibold italic">LylaGlass Admin</div>
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const active = item.href === "/quan-tri" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/75 hover:bg-muted hover:text-foreground",
                active && "bg-muted font-medium text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
