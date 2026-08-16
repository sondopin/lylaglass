import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AdminUser } from "@/lib/api/types";

interface AdminAuthState {
  token: string | null;
  admin: AdminUser | null;
  setSession: (token: string, admin: AdminUser) => void;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setSession: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: "lylaglass-admin-auth" }
  )
);
