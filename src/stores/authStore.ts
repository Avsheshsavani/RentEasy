import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { UserRole, SuperAdmin, Owner, Tenant } from '@/types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  profile: SuperAdmin | Owner | Tenant | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  initialize: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      role: null,
      profile: null,
      isLoading: true,
      isInitialized: false,

      initialize: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            set({ user: session.user, session });
            await get().refreshProfile();
          }
          
          supabase.auth.onAuthStateChange(async (_event, session) => {
            set({ user: session?.user ?? null, session });
            
            if (session?.user) {
              await get().refreshProfile();
            } else {
              set({ role: null, profile: null });
            }
          });
        } finally {
          set({ isLoading: false, isInitialized: true });
        }
      },

      signInWithPhone: async (phone: string) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signInWithOtp({
            phone,
          });
          return { error: error ? new Error(error.message) : null };
        } finally {
          set({ isLoading: false });
        }
      },

      verifyOtp: async (phone: string, token: string) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
          });
          return { error: error ? new Error(error.message) : null };
        } finally {
          set({ isLoading: false });
        }
      },

      signInWithEmail: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          return { error: error ? new Error(error.message) : null };
        } finally {
          set({ isLoading: false });
        }
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null, role: null, profile: null });
      },

      refreshProfile: async () => {
        const { user } = get();
        if (!user) return;

        // maybeSingle: .single() causes HTTP 406 when 0 rows (e.g. owner hitting super_admins under RLS)
        const { data: superAdmin } = await supabase
          .from('super_admins')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (superAdmin) {
          set({ role: 'super_admin', profile: superAdmin });
          return;
        }

        const { data: owner } = await supabase
          .from('owners')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (owner) {
          set({ role: 'owner', profile: owner });
          return;
        }

        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (tenant) {
          set({ role: 'tenant', profile: tenant });
          return;
        }

        // No profile found - new user or error
        set({ role: null, profile: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        role: state.role,
      }),
    }
  )
);
