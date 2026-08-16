"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import { useAdminGuard } from "@/hooks/use-admin-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/quan-tri/dang-nhap";
  const { ready } = useAdminGuard();

  if (isLoginPage) return <>{children}</>;

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1">
        <AdminTopbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
