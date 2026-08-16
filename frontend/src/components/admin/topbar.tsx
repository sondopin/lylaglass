"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAdminAuthStore } from "@/store/admin-auth-store";

export function AdminTopbar() {
  const router = useRouter();
  const admin = useAdminAuthStore((s) => s.admin);
  const logout = useAdminAuthStore((s) => s.logout);

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6">
      <p className="text-sm text-muted-foreground">Xin chào, {admin?.name ?? "Quản trị viên"}</p>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={() => {
          logout();
          router.push("/quan-tri/dang-nhap");
        }}
      >
        Đăng xuất
      </Button>
    </header>
  );
}
