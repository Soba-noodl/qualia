import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoIcon } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/services/integration.service";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function McpAuthorizePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const sessionKey = searchParams.get("session_key");

  const [authorizing, setAuthorizing] = useState(false);
  const [denying, setDenying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If not logged in, redirect to auth then back
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search));
    }
  }, [user, authLoading, navigate]);

  const handleAuthorize = async () => {
    if (!sessionKey) return;
    setAuthorizing(true);
    setError(null);
    try {
      const token = await getAccessToken();

      const res = await fetch(`${SUPABASE_URL}/functions/v1/mcp-auth?action=exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_key: sessionKey }),
      });

      const data = await res.json();
      if (!res.ok || !data.redirect_url) throw new Error(data.error || "Authorization failed");

      // eslint-disable-next-line no-restricted-syntax -- NAV-002: server-built OAuth redirect_url (external to SPA)
      window.location.href = data.redirect_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setAuthorizing(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessionKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Invalid authorization request.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-center gap-3">
          <LogoIcon className="h-8 w-8" />
          <span className="text-muted-foreground text-xl">⟷</span>
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-lg">🤖</div>
        </div>

        <div className="text-center">
          <h1 className="font-semibold text-base">Connect Claude to Qualia</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Claude will be able to read your audits and project context.
          </p>
        </div>

        {/* Permissions */}
        <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Permissions requested</p>
          {[
            "Read audits and findings",
            "Read screenshots (signed URLs, 60 min)",
            "Read project context",
          ].map(p => (
            <div key={p} className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span>{p}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-3.5 w-3.5 shrink-0 text-center leading-none text-red-400">✗</span>
            <span>No writes or modifications</span>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button onClick={handleAuthorize} disabled={authorizing} className="w-full">
            {authorizing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Authorize access
          </Button>
            <Button
            variant="ghost"
            disabled={authorizing || denying}
            className="w-full"
            onClick={async () => {
              if (!sessionKey) { window.close(); setTimeout(() => navigate("/dashboard"), 300); return; }
              setDenying(true);
              try {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/mcp-auth?action=deny`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
                  body: JSON.stringify({ session_key: sessionKey }),
                });
                const data = await res.json();
                // eslint-disable-next-line no-restricted-syntax -- NAV-002: server-built OAuth redirect_url (external to SPA)
                if (data.redirect_url) { window.location.href = data.redirect_url; return; }
                if (!res.ok) {
                  setError("Could not revoke session — please try again.");
                  setDenying(false);
                  return;
                }
              } catch {
                setError("Could not revoke session — please try again.");
                setDenying(false);
                return;
              }
              window.close();
              setTimeout(() => navigate("/dashboard"), 300);
            }}
          >
            {denying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Cancel
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Logged in as <span className="font-medium">{user.email}</span>
        </p>
      </div>
    </div>
  );
}
