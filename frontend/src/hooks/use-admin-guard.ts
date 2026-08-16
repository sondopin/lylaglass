"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuthStore } from "@/store/admin-auth-store";

/** Redirects to the admin login page when no session token is present (client-only, since the token lives in localStorage). */
export function useAdminGuard() {
  const router = useRouter();
  const token = useAdminAuthStore((s) => s.token);
  const admin = useAdminAuthStore((s) => s.admin);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/quan-tri/dang-nhap");
    }
  }, [hydrated, token, router]);

  return { token, admin, ready: hydrated && !!token };
}
