import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { useLanguage } from "@/contexts/LanguageContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function buildErrorRedirect(origin: string, message: string): string {
  try {
    const returnTo = sessionStorage.getItem("oauth_return");
    const base = (returnTo === "settings" || (returnTo && returnTo.startsWith("/")))
      ? (returnTo === "settings" ? "/settings" : returnTo)
      : "/";
    return `${origin}${base}?integration=figma&status=error&message=${encodeURIComponent(message)}`;
  } catch {
    return `${origin}/?integration=figma&status=error&message=${encodeURIComponent(message)}`;
  }
}

const FigmaCallback = () => {
  const [searchParams] = useSearchParams();
  const didRun = useRef(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    /* eslint-disable no-restricted-syntax -- NAV-002: OAuth callback page; all redirects below
       are full-page navigations away from the SPA (back to the host that initiated OAuth) or
       to provider-built error pages. useNavigate() does not apply. */
    if (!SUPABASE_URL) {
      window.location.href = buildErrorRedirect(window.location.origin, "configuration_error");
      return;
    }

    const origin = window.location.origin;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      window.location.href = buildErrorRedirect(origin, errorParam);
      return;
    }

    if (!code || !state) {
      window.location.href = buildErrorRedirect(origin, "missing_params");
      return;
    }

    const completeUrl = `${SUPABASE_URL}/functions/v1/figma-auth`;
    fetch(completeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        let returnPath = "/home";
        try {
          const returnTo = sessionStorage.getItem("oauth_return");
          if (returnTo === "settings") returnPath = "/settings";
          else if (returnTo && returnTo.startsWith("/")) returnPath = returnTo;
        } catch { /* ignore */ }
        const redirectUrl =
          data?.redirectUrl || (res.ok ? `${origin}${returnPath}?integration=figma&status=success` : null);
        if (redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }
        window.location.href = buildErrorRedirect(
          origin,
          data?.error || "token_exchange_failed",
        );
      })
      .catch(() => {
        window.location.href = buildErrorRedirect(origin, "connection_failed");
      });
    /* eslint-enable no-restricted-syntax */
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-4">
      <Logo className="h-8 text-foreground" />
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{t("figmaConnecting")}</p>
      </div>
    </div>
  );
};

export default FigmaCallback;
