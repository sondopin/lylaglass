import { create } from "zustand";
import { AdminUser } from "@/lib/api/types";

/**
 * Holds only the admin's *profile* (name/email/role) for display — never a
 * token. There is nothing here to persist to `localStorage`: the session
 * itself lives entirely in the httpOnly cookie the browser manages, which
 * this app's JavaScript never reads or writes directly.
 *
 * `status` is what `useAuthGuard` actually gates rendering on, and it lives
 * here — in the shared store — rather than as local state inside the guard
 * hook. That distinction is load-bearing: the component that uses the guard
 * (`AppShell`) sits in the root layout, which Next.js keeps mounted across
 * client-side navigations, so a `useEffect` there only ever fires once per
 * full page load. If "are we authenticated" lived in that component's own
 * `useState`, the answer computed *before* login (not authenticated yet)
 * would never be reconsidered after `setAdmin()` runs post-login — the admin
 * would see "Đang tải..." forever until a manual page refresh remounted
 * everything. Routing status through the store instead means `setAdmin`
 * (called once, right after a successful login) is itself what flips
 * `status` to `"authenticated"`, no extra round trip required.
 */
interface AuthState {
  admin: AdminUser | null;
  status: "checking" | "authenticated" | "unauthenticated";
  setAdmin: (admin: AdminUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  admin: null,
  status: "checking",
  setAdmin: (admin) => set({ admin, status: "authenticated" }),
  clear: () => set({ admin: null, status: "unauthenticated" }),
}));
