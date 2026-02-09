import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { auth as authApi, type AuthMe } from "@/lib/api";

interface AuthState {
  user: AuthMe | null;
  isLoading: boolean;
  currentOrgId: string | null;
  setCurrentOrg: (orgId: string) => void;
  fetchUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  currentOrgId: null,

  setCurrentOrg: (orgId: string) => {
    set({ currentOrgId: orgId });
    if (typeof window !== "undefined") {
      localStorage.setItem("mmm_current_org", orgId);
    }
  },

  fetchUser: async () => {
    try {
      set({ isLoading: true });
      const me = await authApi.me();
      const savedOrg =
        typeof window !== "undefined"
          ? localStorage.getItem("mmm_current_org")
          : null;
      const currentOrgId =
        savedOrg && me.organizations.some((o) => o.id === savedOrg)
          ? savedOrg
          : me.organizations[0]?.id || null;

      set({ user: me, currentOrgId, isLoading: false });
    } catch {
      set({ user: null, isLoading: false, currentOrgId: null });
    }
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, currentOrgId: null });
    if (typeof window !== "undefined") {
      localStorage.removeItem("mmm_current_org");
      window.location.href = "/login";
    }
  },
}));
