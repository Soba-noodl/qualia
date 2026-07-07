import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { useLanguage } from "@/contexts/LanguageContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getReturnPath(): string {
  try {
    const returnTo = sessionStorage.getItem("oauth_return");
    sessionStorage.removeItem("oauth_return");
    if (returnTo === "settings") return "/settings";
    if (returnTo && returnTo.startsWith("/")) return returnTo;
  } catch { /* ignore */ }
  return "/settings";
}

const NotionCallback = () => {
  const [searchParams] = useSearchParams();
  const didRun = useRef(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    /* eslint-disable no-restricted-syntax -- NAV-002: OAuth callback page; all redirects below
       are full-page navigations to /settings (post-OAuth handoff). useNavigate() would re-render
       inside the callback context and miss the query params consumers downstream rely on. */
    if (!SUPABASE_URL) {
      window.location.href = `${window.location.origin}/settings?integration=notion&status=error&message=${encodeURIComponent("configuration_error")}`;
      return;
    }

    const origin = window.location.origin;
    const returnPath = getReturnPath();
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    const errorRedirect = (message: string) => {
      window.location.href = `${origin}${returnPath}?integration=notion&status=error&message=${encodeURIComponent(message)}`;
    };

    if (errorParam) {
      errorRedirect(errorParam);
      return;
    }

    if (!code || !state) {
      errorRedirect("missing_params");
      return;
    }

    const completeUrl = `${SUPABASE_URL}/functions/v1/notion-auth/complete`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    fetch(completeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          window.location.href = `${origin}${returnPath}?integration=notion&status=success`;
          return;
        }
        errorRedirect(data?.error || "token_exchange_failed");
      })
      .catch(() => {
        errorRedirect("connection_failed");
      });
    /* eslint-enable no-restricted-syntax */
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-4">
      <Logo className="h-8 text-foreground" />
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{t("notionConnecting")}</p>
      </div>
    </div>
  );
};

export default NotionCallback;
