import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { z } from "zod";
import { toast } from "@/components/ui/sonner";
import { posthog } from "@/lib/posthog";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/** Minimal login page for the Figma plugin iframe. After login, creates a plugin token and posts it to the parent. */
const PluginAuth = () => {
  const { session, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const figmaState = searchParams.get("figma_state");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const tokenSentRef = useRef(false);

  // When a session exists, create or claim a plugin token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = params.get("error") || hashParams.get("error");
    const description = params.get("error_description") || hashParams.get("error_description");
    if (errorCode) {
      const msg = description || errorCode;
      toast.error(`Google sign-in failed: ${msg}. Try email or contact support.`);
      posthog.capture("auth_oauth_callback_error", { provider: "google", error: errorCode, description, surface: "plugin_auth" });
      window.history.replaceState({}, "", window.location.pathname + (figmaState ? `?figma_state=${figmaState}` : ""));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session || tokenSentRef.current) return;
    // Only proceed when there is an active Figma auth flow.
    // Without figma_state we have no safe action to take — skip to avoid
    // overwriting an existing plugin token and logging the user out.
    if (!figmaState) return;
    tokenSentRef.current = true;

    void (async () => {
      try {
        // Browser OAuth flow: claim the link code
        const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-plugin-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "claim-link", state: figmaState }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || t("pluginAuthFailedConnect"));
          tokenSentRef.current = false;
          return;
        }
        setConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("pluginAuthFailedConnect"));
        tokenSentRef.current = false;
      }
    })();
  }, [session, figmaState, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });
      if (signInError) throw signInError;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pluginAuthSignInFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const redirectTo = figmaState
      ? `${window.location.origin}/plugin-auth?figma_state=${figmaState}`
      : `${window.location.origin}/plugin-auth`;
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      posthog.capture("auth_oauth_failed", { provider: "google", message: oauthError.message, surface: "plugin_auth" });
      return;
    }
    // eslint-disable-next-line no-restricted-syntax -- NAV-002: Google OAuth provider URL (external)
    if (data?.url) window.location.href = data.url;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-3">
        <Logo size="md" />
        {figmaState ? (
          <>
            <p className="text-foreground font-medium">{t("pluginAuthConnectedTab")}</p>
            <p className="text-sm text-muted-foreground">{t("pluginAuthReturnToFigma")}</p>
          </>
        ) : (
          <p className="text-foreground font-medium">{t("pluginAuthConnected")}</p>
        )}
      </div>
    );
  }

  if (session && !error && !figmaState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-3">
        <Logo size="md" />
        <p className="text-foreground font-medium">{t("pluginAuthConnectedTab")}</p>
        <p className="text-sm text-muted-foreground">{t("pluginAuthReturnToFigma")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <Logo size="sm" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {figmaState ? t("pluginAuthConnectTitle") : t("pluginAuthLoginTitle")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {figmaState
            ? t("pluginAuthConnectDesc")
            : t("pluginAuthLoginDesc")}
        </p>

        <Button variant="outline" className="w-full mb-4" onClick={handleGoogleLogin} type="button">
          <svg aria-hidden="true" className="w-4 h-4 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t("pluginAuthGoogleButton")}
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plugin-auth-email">{t("pluginAuthEmailLabel")}</Label>
            <Input id="plugin-auth-email" type="email" placeholder="you@company.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required className="w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plugin-auth-password">{t("pluginAuthPasswordLabel")}</Label>
            <Input id="plugin-auth-password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required className="w-full" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("pluginAuthEmailButton")}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PluginAuth;