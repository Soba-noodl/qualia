import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

const PENDING_INVITE_KEY = "pendingInviteToken";

const ERROR_MESSAGES: Record<string, string> = {
  INVITE_NOT_FOUND: "This invitation link is invalid or has already been removed.",
  INVITE_ALREADY_USED: "This invitation has already been accepted.",
  INVITE_EXPIRED: "This invitation has expired. Ask the team owner to send a new one.",
  USER_NOT_FOUND: "No account was found for this invitation. Please sign up first.",
  ACTIVATION_FAILED: "Something went wrong activating your invite. Please try again.",
  WRONG_EMAIL: "This invitation was sent to a different email address.",
};

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, session, loading } = useAuth();
  const calledRef = useRef(false);

  const token = searchParams.get("token") ?? "";

  useEffect(() => {
    if (!token) {
      toast.error("Invalid invitation link.");
      navigate("/dashboard");
      return;
    }

    // Wait until auth state is resolved
    if (loading) return;

    if (calledRef.current) return;
    calledRef.current = true;

    if (!user || !session) {
      // Store token so Auth page can pick it up after signup
      sessionStorage.setItem(PENDING_INVITE_KEY, token);
      navigate(`/auth?mode=signup&invite=${encodeURIComponent(token)}`, { replace: true });
      return;
    }

    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("accept-invite", {
          body: { token },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error) throw error;

        if (!data?.ok) {
          const code = data?.error as string | undefined;
          if (code === "WRONG_EMAIL") {
            toast.error(ERROR_MESSAGES.WRONG_EMAIL + " Please sign in with the invited email.");
            await supabase.auth.signOut();
            sessionStorage.setItem(PENDING_INVITE_KEY, token);
            navigate(`/auth?mode=signin&invite=${encodeURIComponent(token)}`, { replace: true });
            return;
          }
          const msg = (code && ERROR_MESSAGES[code]) ?? "Failed to accept the invitation.";
          toast.error(msg);
          navigate("/dashboard", { replace: true });
        } else {
          const orgName = data.org_name as string | null;
          toast.success(orgName ? `Welcome to ${orgName}!` : "You've joined the team!");
          navigate("/dashboard", { replace: true });
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
        navigate("/dashboard", { replace: true });
      }
    })();
  }, [token, user, session, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Accepting invitation…</p>
      </div>
    </div>
  );
}
