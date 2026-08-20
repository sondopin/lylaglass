"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/sidebar";
import { AdminTopbar } from "@/components/topbar";
import { useAuthGuard } from "@/hooks/use-auth-guard";

/**
 * Equivalent of the old `app/admin/layout.tsx` from the combined app, now
 * that this whole app *is* the admin panel. The login page is the one route
 * that must render without the guard running (there is no session yet to
 * check), everything else waits for `useAuthGuard` to confirm the cookie is
 * valid before rendering the sidebar/topbar chrome.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { ready } = useAuthGuard();

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
