"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api/admin";
import { setCsrfToken } from "@/lib/csrf";
import { useAuthStore } from "@/store/auth-store";

export function AdminTopbar() {
  const router = useRouter();
  const admin = useAuthStore((s) => s.admin);
  const clear = useAuthStore((s) => s.clear);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Clears the httpOnly cookie server-side — this app's JS cannot clear
      // it on its own, unlike the old localStorage token.
      await adminApi.logout();
    } catch {
      // Best-effort: even if the network call fails, still drop the local
      // session state and send the admin back to the login screen.
    } finally {
      clear();
      setCsrfToken(null);
      router.push("/login");
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6">
      <p className="text-sm text-muted-foreground">Xin chào, {admin?.name ?? "Quản trị viên"}</p>
      <Button variant="outline" size="sm" className="rounded-full" disabled={loggingOut} onClick={handleLogout}>
        {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>
    </header>
  );
}
