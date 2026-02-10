import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export interface AuthMe {
  user_id: string;
  email: string;
  organizations: { id: string; name: string; slug: string; role: string }[];
}

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
      const supabase = createClient();

      // Get authenticated user directly from Supabase
      const {
        data: { user: sbUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !sbUser) {
        set({ user: null, isLoading: false, currentOrgId: null });
        return;
      }

      // Get user's organizations via memberships table (RLS allows own rows)
      const { data: memberships } = await supabase
        .from("memberships")
        .select("role, organizations(id, name, slug)")
        .eq("user_id", sbUser.id);

      const orgs = (memberships || [])
        .filter((m: Record<string, unknown>) => m.organizations)
        .map((m: Record<string, unknown>) => {
          const org = m.organizations as Record<string, unknown>;
          return {
            id: org.id as string,
            name: org.name as string,
            slug: org.slug as string,
            role: m.role as string,
          };
        });

      const me: AuthMe = {
        user_id: sbUser.id,
        email: sbUser.email || "",
        organizations: orgs,
      };

      const savedOrg =
        typeof window !== "undefined"
          ? localStorage.getItem("mmm_current_org")
          : null;
      const currentOrgId =
        savedOrg && me.organizations.some((o) => o.id === savedOrg)
          ? savedOrg
          : me.organizations[0]?.id || null;

      set({ user: me, currentOrgId, isLoading: false });
    } catch (err) {
      console.error("[auth-store] fetchUser failed:", err);
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
