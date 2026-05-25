import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Loader2, Eye, EyeOff, Lock, Check } from "lucide-react";
import Logo from "@/components/Logo";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { checkPasswordConstraints, isPasswordValid, PASSWORD_MIN_LENGTH } from "@/utils/password";

const passwordSchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const RESET_PASSWORD_GRACE_MS = 1500;

const ResetPassword = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { session, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [gracePeriodOver, setGracePeriodOver] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // Allow a short grace period for recovery link token to be processed by AuthContext
  useEffect(() => {
    if (authLoading || session) return;
    const id = setTimeout(() => setGracePeriodOver(true), RESET_PASSWORD_GRACE_MS);
    return () => clearTimeout(id);
  }, [authLoading, session]);

  const checkingSession = authLoading || (!session && !gracePeriodOver);
  const isValidSession = !!session;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const errorMessage = validation.error.errors[0].message;
      if (errorMessage === "Passwords do not match") {
        toast.error(t("authPasswordMismatch"));
      } else {
        toast.error(errorMessage);
      }
      return;
    }

    if (!isPasswordValid(password)) {
      toast.error(t("authPasswordRequirements"));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success(t("authPasswordUpdated"));
      setSucceeded(true);

      // Sign out and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Invalid or Expired Link</h2>
          <p className="text-muted-foreground mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Button onClick={() => navigate("/auth")} variant="default">
            {t("authBackToSignIn")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Logo size="lg" className="justify-center mb-8" />

        {/* Form Card */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              {t("authResetPasswordHeader")}
            </h2>
            <p className="text-muted-foreground">
              {t("authResetPasswordSubheader")}
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                {t("authNewPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-muted-foreground">{t("authPasswordRequirements")}</p>
                {(() => {
                  const c = checkPasswordConstraints(password);
                  return (
                    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-1.5">
                        {c.minLength ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0 inline-block" />}
                        {t("authPasswordRequirementMinLength")}
                      </li>
                      <li className="flex items-center gap-1.5">
                        {c.hasUppercase ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0 inline-block" />}
                        {t("authPasswordRequirementUppercase")}
                      </li>
                      <li className="flex items-center gap-1.5">
                        {c.hasLowercase ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0 inline-block" />}
                        {t("authPasswordRequirementLowercase")}
                      </li>
                      <li className="flex items-center gap-1.5">
                        {c.hasNumber ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0 inline-block" />}
                        {t("authPasswordRequirementNumber")}
                      </li>
                    </ul>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground font-medium">
                {t("authConfirmPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || succeeded}
              className="w-full h-11 font-medium"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("authUpdatePassword")
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("authBackToSignIn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
