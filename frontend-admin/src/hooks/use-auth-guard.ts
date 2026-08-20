"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api/admin";
import { setCsrfToken } from "@/lib/csrf";
import { useAuthStore } from "@/store/auth-store";

/**
 * Establishes (or rejects) the admin session by asking the server, then
 * redirects to `/login` if it says no.
 *
 * The verification only runs while `status === "checking"` — the store's
 * initial value on every fresh page load, and nothing else ever sets it back
 * to that value. Two things reach `"authenticated"` without this hook making
 * another network call:
 *
 *  1. A successful `/me` here, on the first genuine page load (fresh cookie
 *     state the browser hasn't confirmed to us yet).
 *  2. A successful login — `app/login/page.tsx` calls the same store's
 *     `setAdmin()` directly with the response it already has, since a login
 *     response *is* proof of a valid session and re-asking `/me` immediately
 *     after would be redundant.
 *
 * Case 2 is what makes the guard behave correctly across a client-side
 * `router.push("/")` right after login, rather than getting stuck showing
 * "Đang tải..." until a manual reload: `AppShell` (which calls this hook)
 * lives in the root layout and is never remounted by that navigation, so a
 * one-shot check tied to *mount* would compute its answer once, before login
 * happened, and never revisit it. Gating on shared `status` instead of local
 * component state means the login page flipping that status is enough on its
 * own — no remount required.
 */
export function useAuthGuard() {
  const router = useRouter();
  const admin = useAuthStore((s) => s.admin);
  const status = useAuthStore((s) => s.status);
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (status !== "checking") return;

    let cancelled = false;

    adminApi
      .me()
      .then((data) => {
        if (cancelled) return;
        setCsrfToken(data.csrfToken);
        setAdmin({ id: data.id, name: data.name, email: data.email, role: data.role });
      })
      .catch(() => {
        if (cancelled) return;
        // Any failure (401 from an absent/expired cookie, or a network error)
        // means there is no session to trust — fail closed.
        clear();
        setCsrfToken(null);
      });

    return () => {
      cancelled = true;
    };
  }, [status, setAdmin, clear]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  return { admin, ready: status === "authenticated" };
}
