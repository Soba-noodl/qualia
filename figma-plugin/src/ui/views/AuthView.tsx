import React, { useState, useEffect, useRef } from "react";
import type { Store } from "../store";
import { setPluginToken } from "../api";
import { usePluginLanguage } from "../usePluginLanguage";
import { Button } from "../components/Button";
import { QualiaLogo } from "../components/PluginShell";

// Injected at build time by esbuild `define` (see figma-plugin/esbuild.config.mjs).
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON__: string;
declare const __APP_URL__: string;

const SUPABASE_URL = typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : "";
const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON__ !== "undefined" ? __SUPABASE_ANON__ : "";
const APP_URL = typeof __APP_URL__ !== "undefined" ? __APP_URL__ : "https://qualia-ux.com";

type Props = { store: Store; setStore: (patch: Partial<Store>) => void };

export function AuthView({ store, setStore }: Props) {
  const { t } = usePluginLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google / browser OAuth state
  const [oauthState, setOauthState] = useState<string | null>(null);
  const [oauthPolling, setOauthPolling] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  const storeToken = (token: string) => {
    setPluginToken(token);
    setStore({ token, connectedFeedback: true });
    // Persist to localStorage as a backup (in case figma.clientStorage is unavailable)
    try { localStorage.setItem("qualia_plugin_token", token); } catch { /* ignore */ }
    (window as unknown as { parent: { postMessage: (m: unknown, o: string) => void } }).parent.postMessage(
      { pluginMessage: { type: "store-token", token } }, "*"
    );
  };

  const pollForToken = (state: string, attempts = 0) => {
    if (attempts > 150) { // 5 min max
      setOauthPolling(false);
      setOauthState(null);
      setOauthError(t("pluginOAuthTimedOut"));
      return;
    }
    pollRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-plugin-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: "check-link", state }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 200 && data.token) {
          setOauthPolling(false);
          setOauthState(null);
          storeToken(data.token);
        } else if (res.status === 202) {
          pollForToken(state, attempts + 1);
        } else if (res.status === 410) {
          setOauthPolling(false);
          setOauthState(null);
          setOauthError(t("pluginOAuthExpired"));
        } else {
          setOauthPolling(false);
          setOauthState(null);
          setOauthError(data?.error || t("pluginAuthSignInFailed"));
        }
      } catch {
        // Network error, retry
        pollForToken(state, attempts + 1);
      }
    }, 2000);
  };

  const handleGoogleLogin = async () => {
    setOauthError(null);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-plugin-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: "create-link" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.state) throw new Error(data.error || t("pluginOAuthFailed"));
      const state = data.state;
      setOauthState(state);
      setOauthPolling(true);
      // Open browser
      const url = `${APP_URL}/plugin-auth?figma_state=${state}`;
      (window as unknown as { open: (u: string, t: string) => void }).open(url, "_blank");
      pollForToken(state);
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : t("pluginOAuthFailed"));
    }
  };

  const cancelOAuth = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    setOauthPolling(false);
    setOauthState(null);
    setOauthError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password }),
      });
      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok) throw new Error(authData.error_description || authData.msg || authData.message || t("pluginAuthSignInFailed"));
      const accessToken: string = authData.access_token;

      const tokenRes = await fetch(`${SUPABASE_URL}/functions/v1/manage-plugin-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "create" }),
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok) throw new Error(tokenData.error || tokenData.message || t("pluginAuthFailedConnect"));
      const token: string = tokenData.token;
      if (typeof token !== "string") throw new Error(t("pluginAuthInvalidResponse"));
      storeToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pluginAuthSignInFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Connected state
  if (store.connectedFeedback) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
        <QualiaLogo />
        <p className="text-[14px] font-semibold text-foreground mb-1 mt-5">{t("pluginAuthConnected")}</p>
      </div>
    );
  }

  // OAuth polling state
  if (oauthPolling && oauthState) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
        <QualiaLogo />
        <div
          className="w-8 h-8 rounded-full border-[3px] border-border border-t-primary mb-4"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <p className="text-[14px] font-medium text-foreground mb-1.5">{t("pluginOAuthPolling")}</p>
        <p className="text-[12px] text-foreground/65 mb-5">{t("pluginOAuthPollingSub")}</p>
        <Button variant="secondary" size="sm" onClick={cancelOAuth}>
          {t("pluginCancel")}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[280px] flex flex-col gap-4">
        {/* Logo hero */}
        <div className="flex flex-col items-center gap-3 mb-2">
          <QualiaLogo />
          <div className="text-center">
            <h2 className="text-[17px] font-semibold text-foreground mb-0.5">{t("pluginAuthLoginTitle")}</h2>
            <p className="text-[12px] text-foreground/65 leading-relaxed">{t("pluginAuthConnectDesc")}</p>
          </div>
        </div>

        {/* Error messages */}
        {(oauthError || error) && (
          <p className="text-[12px] text-destructive text-center">{oauthError || error}</p>
        )}

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 bg-surface-1 border border-border rounded-lg px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t("pluginAuthGoogleButton")}
        </button>

        {/* Divider */}
        <div className="relative flex items-center">
          <div className="flex-1 border-t border-border" />
          <span className="px-2 text-[12px] text-foreground/65">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="plugin-auth-email" className="text-[11px] font-medium text-subtle uppercase tracking-wide">
              {t("pluginAuthEmailLabel")}
            </label>
            {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- sibling <label htmlFor="plugin-auth-email"> above provides the accessible name; jsx-a11y can't trace cross-element htmlFor linkage reliably */}
            <input
              id="plugin-auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="plugin-auth-password" className="text-[11px] font-medium text-subtle uppercase tracking-wide">
              {t("pluginAuthPasswordLabel")}
            </label>
            {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- sibling <label htmlFor="plugin-auth-password"> above provides the accessible name; jsx-a11y can't trace cross-element htmlFor linkage reliably */}
            <input
              id="plugin-auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {loading ? t("pluginSigningIn") : t("pluginAuthEmailButton")}
          </Button>
        </form>

        {/* Sign-up prompt */}
        <p className="text-center text-[12px] text-foreground/65">
          {t("pluginDontHaveAccount")}{" "}
          <a
            href={`${APP_URL}/auth`}
            target="_blank"
            rel="noreferrer"
            className="text-primary cursor-pointer font-medium"
          >
            {t("pluginCreateOne")}
          </a>
        </p>
      </div>
    </div>
  );
}
