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
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/products", label: "Sản phẩm", icon: Package },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { href: "/admin/orders", label: "Đơn hàng", icon: ShoppingCart },
  { href: "/admin/customers", label: "Khách hàng", icon: Users },
  { href: "/admin/inventory", label: "Tồn kho", icon: Boxes },
  { href: "/admin/coupons", label: "Mã giảm giá", icon: TicketPercent },
  { href: "/admin/payments", label: "Thanh toán", icon: CreditCard },
  { href: "/admin/shipping", label: "Vận chuyển", icon: Truck },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-background lg:block">
      <div className="flex h-16 items-center px-6 font-heading text-lg font-semibold italic">LylaGlass Admin</div>
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
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
