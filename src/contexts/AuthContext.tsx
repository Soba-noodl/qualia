import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { User, Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { posthog } from "@/lib/posthog";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

const PENDING_INVITE_KEY = "pendingInviteToken";

async function processPendingInvite(accessToken: string) {
  const token = sessionStorage.getItem(PENDING_INVITE_KEY);
  if (!token) return;
  sessionStorage.removeItem(PENDING_INVITE_KEY);
  try {
    const { data, error } = await supabase.functions.invoke("accept-invite", {
      body: { token },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) throw error;
    if (data?.ok) {
      const orgName = data.org_name as string | null;
      toast.success(orgName ? `Welcome to ${orgName}!` : "You've joined the team!");
      void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.my() });
    } else {
      const messages: Record<string, string> = {
        WRONG_EMAIL: "This invitation was sent to a different email address.",
        INVITE_NOT_FOUND: "Invitation link is invalid or has already been removed.",
        INVITE_ALREADY_USED: "This invitation has already been accepted.",
        INVITE_EXPIRED: "Invitation has expired. Ask the team owner to send a new one.",
        ACTIVATION_FAILED: "Could not activate your invite. Please try again.",
      };
      const code = data?.error as string | undefined;
      toast.error((code && messages[code]) ?? "Failed to accept the invitation.");
    }
  } catch {
    // intentional: network/parse failures surface to user via toast — no log needed
    toast.error("Something went wrong accepting your invite.");
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncProfileIdentity(user: User): Promise<void> {
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "User";
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, display_name: displayName, avatar_url: avatarUrl },
      { onConflict: "user_id", ignoreDuplicates: true }
    );
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const SIGN_OUT_FLAG_KEY = "qualia_lastSignedOutUserId";

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      const lastSignedOutUserId = localStorage.getItem(SIGN_OUT_FLAG_KEY);
      if (s && lastSignedOutUserId === s.user?.id) {
        setSession(null);
        setUser(null);
        // Best-effort global sign-out to clear Supabase cookies if still present
        supabase.auth.signOut().catch((err) => {
          console.warn("[auth] best-effort signOut after stale session failed:", err);
        });
      } else {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          posthog.identify(s.user.id, { email: s.user.email ?? undefined });
          syncProfileIdentity(s.user).catch((err) => {
            console.warn("[auth] syncProfileIdentity failed (non-critical):", err);
          });
        }
        if (s?.user?.id && lastSignedOutUserId === s.user.id) {
          localStorage.removeItem(SIGN_OUT_FLAG_KEY);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      // A fresh SIGNED_IN always wins — clear the sign-out flag and accept the session.
      if (event === "SIGNED_IN") {
        localStorage.removeItem(SIGN_OUT_FLAG_KEY);
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          posthog.identify(s.user.id, { email: s.user.email ?? undefined });
          syncProfileIdentity(s.user).catch((err) => {
            console.warn("[auth] syncProfileIdentity failed (non-critical):", err);
          });
        }
        if (s?.access_token) {
          processPendingInvite(s.access_token).catch((err) => {
            console.error("[auth] processPendingInvite failed:", err);
            toast.error("Couldn't accept your invite — please try opening the invite link again, or ask the inviter to resend it.");
          });
        }
        return;
      }
      const lastSignedOutUserId = localStorage.getItem(SIGN_OUT_FLAG_KEY);
      if (s && lastSignedOutUserId === s.user?.id) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user?.id && lastSignedOutUserId === s.user.id) {
          localStorage.removeItem(SIGN_OUT_FLAG_KEY);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      if (session?.user?.id) {
        localStorage.setItem(SIGN_OUT_FLAG_KEY, session.user.id);
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
         
        console.error("Supabase signOut error", error);
      }
    } finally {
      posthog.reset();
      // Always clear local auth state so the app routing behaves correctly
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  }, [session]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/** Wraps protected routes: shows spinner while loading, redirects to /auth when not signed in. */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div role="status" aria-live="polite" aria-busy="true">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
