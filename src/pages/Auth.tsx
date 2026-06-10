import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Loader2, Eye, EyeOff, Check, ArrowLeft, Mail } from "lucide-react";
import Logo from "@/components/Logo";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { checkPasswordConstraints, isPasswordValid } from "@/utils/password";
import { getLatestChangelogVersionKey } from "@/lib/changelog";
import { posthog } from "@/lib/posthog";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const { user, session } = useAuth();
  const [isLogin, setIsLogin] = useState(() => {
    const modeParam = new URLSearchParams(window.location.search).get("mode");
    if (modeParam === "signin") return true;
    if (modeParam === "signup") return false;
    try {
      // If any Supabase or Qualia session keys exist, this is a returning user → default to Sign In
      return Object.keys(localStorage).some(
        (k) => k.startsWith("sb-") || k.startsWith("qualia_tutorial")
      );
    } catch {
      return false;
    }
  });
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const submittingRef = useRef(false);
  const emailFormRef = useRef<HTMLFormElement>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Parse OAuth callback errors from the URL (e.g. ?error=access_denied&error_description=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = params.get("error") || hashParams.get("error");
    const description = params.get("error_description") || hashParams.get("error_description");
    if (errorCode) {
      const msg = t("authGoogleCallbackError").replace("{description}", description || errorCode);
      toast.error(msg);
      posthog.capture("auth_oauth_callback_error", { provider: "google", error: errorCode, description, surface: "auth_page" });
      // Clean up the URL so the error doesn't re-show on refresh
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user || !session) return;
    const returnTo = searchParams.get("returnTo");
    const isSafe = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/\\");
    navigate(isSafe ? returnTo : "/dashboard");
  }, [user, session, navigate, searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (!isLogin && !isPasswordValid(password)) {
      toast.error(t("authPasswordRequirements"));
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setLoginFailed(true);
          throw error;
        }
        toast.success("Welcome back!");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) {
          const errorMsg = error.message.toLowerCase();
          
          // CASE A: Existing User - only redirect if Supabase explicitly says so
          if (errorMsg.includes("registered") || errorMsg.includes("exists") || errorMsg.includes("unique")) {
            toast.error("Account already exists. Switching to login...");
            setIsLogin(true);
            submittingRef.current = false;
            return;
          }

          // CASE B: All other errors (weak password, server errors, etc.) - show exact message
          toast.error(error.message);
          return;
        }

        // CASE C: Supabase returns a fake 200 for already-registered emails
        // to prevent email enumeration. Detect by checking identities array.
        const identities = data?.user?.identities;
        if (identities && identities.length === 0) {
          toast.error("Account already exists. Switching to login...");
          setIsLogin(true);
          submittingRef.current = false;
          return;
        }

        setSignupEmailSent(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleResendEmail = async () => {
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      toast.success(t("authSignupResendSent"));
      setResendCooldown(60);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast.success(t("authResetLinkSent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset email");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const benefits = [
    t("authBenefit1"),
    t("authBenefit2"),
    t("authBenefit3"),
  ];
  const latestChangelogVersion = t(getLatestChangelogVersionKey());

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Value Proposition */}
      <div className="hidden lg:flex lg:w-1/2 bg-background relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full">
          {/* Logo */}
          <Logo size="lg" className="mb-12" />

          {/* Main Headline */}
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-10 text-gradient">
            {t("authHeadline")}
          </h1>

          {/* Benefits List */}
          <ul className="space-y-4 mb-12">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-muted-foreground text-lg">{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Social Proof */}
          <div className="border-l-2 border-primary/30 pl-6 py-2">
            <p className="text-foreground/90 italic text-lg mb-3">
              "{t("authTestimonial")}"
            </p>
            <p className="text-muted-foreground text-sm">
              {t("authTestimonialAttribution")}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <main id="main-content" className="w-full lg:w-1/2 bg-auth-form-bg flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          {/* Back button - returns to previous page */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.history.length > 1 && document.referrer && new URL(document.referrer).origin === window.location.origin) {
                navigate(-1);
              } else {
                navigate("/");
              }
            }}
            className="mb-6 -ml-2 text-auth-form-text-muted hover:text-auth-form-text"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
          {/* Mobile Logo */}
          <Logo size="md" className="mb-8 lg:hidden" />

          {/* Migration notice — only shown to returning users after a failed login */}
          {isLogin && loginFailed && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <p className="font-semibold mb-1">{t("authMigrationNoticeTitle")}</p>
              <p className="leading-snug">{t("authMigrationNoticeBody")}</p>
            </div>
          )}

          {/* Form Header — hidden when showing signup confirmation (panel is self-contained) */}
          {!signupEmailSent && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-auth-form-text mb-2">
                {isForgotPassword
                  ? t("authForgotPasswordHeader")
                  : isLogin
                    ? t("authSignInHeader")
                    : t("authSignUpHeader")}
              </h2>
              <p className="text-auth-form-text-muted">
                {isForgotPassword
                  ? t("authForgotPasswordSubheader")
                  : isLogin
                    ? t("authSignInSubheader")
                    : t("authSignUpSubheader")}
              </p>
            </div>
          )}

          {/* Signup Confirmation Panel */}
          {!isForgotPassword && signupEmailSent ? (
            <div className="py-4">
              {/* Icon with ripple rings */}
              <div className="cfu-s1 flex justify-center mb-9">
                <div className="relative w-16 h-16">
                  <div className="cfu-ring-1 absolute inset-0 rounded-2xl bg-primary/20" />
                  <div className="cfu-ring-2 absolute inset-0 rounded-2xl bg-primary/15" />
                  <div className="cfu-ring-3 absolute inset-0 rounded-2xl bg-primary/10" />
                  <div
                    className="cfu-icon absolute inset-0 rounded-2xl bg-primary flex items-center justify-center"
                    style={{ boxShadow: "0 6px 28px hsl(var(--primary) / 0.32)" }}
                  >
                    <Mail className="h-7 w-7 text-white" />
                  </div>
                </div>
              </div>

              {/* Headline */}
              <div className="cfu-s2 text-center mb-4">
                <h2 className="text-[1.65rem] font-bold text-auth-form-text tracking-tight leading-tight">
                  {t("authSignupConfirmationTitle")}
                </h2>
                <p className="text-sm text-auth-form-text-muted mt-2">
                  {t("authSignupConfirmationMessage")}
                </p>
              </div>

              {/* Email pill */}
              <div className="cfu-s3 flex justify-center mb-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/25 bg-primary/5 max-w-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-auth-form-text truncate">{email}</span>
                </div>
              </div>

              <p className="cfu-s3 text-center text-sm text-auth-form-text-muted mb-7">
                {t("authSignupConfirmationInstruction")}
              </p>

              {/* Divider */}
              <div className="cfu-s4 border-t border-auth-form-input-border mb-6" />

              {/* Recovery actions */}
              <div className="cfu-s4 space-y-3">
                <div className="text-center">
                  <p className="text-sm font-semibold text-auth-form-text mb-0.5">
                    {t("authSignupDidntGetIt")}
                  </p>
                  <p className="text-xs text-auth-form-text-muted">
                    {t("authSignupCheckSpam")}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || resendLoading}
                  onClick={handleResendEmail}
                  className="w-full h-10 rounded-lg border border-auth-form-input-border bg-transparent text-sm font-medium text-auth-form-text hover:bg-auth-form-input-bg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resendLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {resendCooldown > 0
                    ? t("authSignupResendCooldown").replace("{seconds}", String(resendCooldown))
                    : t("authSignupResend")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSignupEmailSent(false);
                    setResendCooldown(0);
                  }}
                  className="w-full h-9 rounded-lg text-sm text-auth-form-text-muted hover:text-auth-form-text transition-colors"
                >
                  {t("authSignupChangeEmail")}
                </button>
              </div>

              {/* Back to sign in */}
              <div className="cfu-s5 mt-7 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setSignupEmailSent(false);
                    setResendCooldown(0);
                    setIsLogin(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary/80 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("authBackToSignIn")}
                </button>
              </div>
            </div>
          ) : isForgotPassword ? (
            resetEmailSent ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-6 w-6 text-primary" />
                </div>
                <p className="text-auth-form-text-muted mb-6">{t("authResetLinkSent")}</p>
                <div className="flex flex-col gap-3 items-center">
                  <button
                    type="button"
                    onClick={() => setResetEmailSent(false)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Try a different email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setResetEmailSent(false);
                    }}
                    className="text-sm text-primary font-medium hover:text-primary/80 transition-colors"
                  >
                    {t("authBackToSignIn")}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-auth-form-text-muted font-medium">
                    {t("authEmailLabel")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-auth-form-input-bg border-auth-form-input-border text-auth-form-text placeholder:text-auth-form-text-muted/60 focus:border-primary focus:ring-primary h-11"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-medium"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("authSendResetLink")
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-sm text-auth-form-text-muted hover:text-auth-form-text transition-colors"
                  >
                    {t("authBackToSignIn")}
                  </button>
                </div>
              </form>
            )
          ) : (
            <>
              {/* Google Sign-in Button */}
              <Button
                type="button"
                onClick={async () => {
                  setGoogleLoading(true);
                  try {
                    const returnTo = searchParams.get("returnTo");
                    const safeReturnTo =
                      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/\\")
                        ? returnTo
                        : "/dashboard";
                    const { data, error } = await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: { redirectTo: `${window.location.origin}${safeReturnTo}` },
                    });
                    if (error) {
                      const msg = error.message || t("authGoogleFailedToast");
                      toast.error(msg);
                      posthog.capture("auth_oauth_failed", { provider: "google", message: msg, surface: "auth_page" });
                      return;
                    }
                    // eslint-disable-next-line no-restricted-syntax -- NAV-002: Google OAuth provider URL (external)
                    if (data?.url) window.location.href = data.url;
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : t("authGoogleFailedToast");
                    toast.error(msg);
                    posthog.capture("auth_oauth_failed", { provider: "google", message: msg, surface: "auth_page" });
                  } finally {
                    setGoogleLoading(false);
                  }
                }}
                disabled={googleLoading || loading}
                className="w-full h-11 bg-auth-form-input-bg text-auth-form-text hover:bg-auth-form-input-border border border-transparent font-medium"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <svg aria-hidden="true" className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t("authGoogleSignIn")}
                  </>
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-auth-form-input-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-auth-form-bg px-2 text-auth-form-text-muted/60">{t("authOrContinueWith")}</span>
                </div>
              </div>

              {/* Auth Form */}
              <form ref={emailFormRef} onSubmit={handleAuth} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-auth-form-text-muted font-medium">
                    {t("authEmailLabel")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-auth-form-input-bg border-auth-form-input-border text-auth-form-text placeholder:text-auth-form-text-muted/60 focus:border-primary focus:ring-primary h-11"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-auth-form-text-muted font-medium">
                      {t("authPasswordLabel")}
                    </Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setSignupEmailSent(false);
                          setResendCooldown(0);
                        }}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        {t("authForgotPassword")}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-auth-form-input-bg border-auth-form-input-border text-auth-form-text placeholder:text-auth-form-text-muted/60 focus:border-primary focus:ring-primary h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-auth-form-text-muted/60 hover:text-auth-form-text-muted transition-colors"
                      aria-label={showPassword ? t("authHidePassword") : t("authShowPassword")}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!isLogin && (() => {
                    const c = checkPasswordConstraints(password);
                    return (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-xs text-auth-form-text-muted/60">{t("authPasswordRequirements")}</p>
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-auth-form-text-muted/60">
                          <li className="flex items-center gap-1.5">
                            {c.minLength ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-auth-form-input-border shrink-0 inline-block" />}
                            {t("authPasswordRequirementMinLength")}
                          </li>
                          <li className="flex items-center gap-1.5">
                            {c.hasUppercase ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-auth-form-input-border shrink-0 inline-block" />}
                            {t("authPasswordRequirementUppercase")}
                          </li>
                          <li className="flex items-center gap-1.5">
                            {c.hasLowercase ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-auth-form-input-border shrink-0 inline-block" />}
                            {t("authPasswordRequirementLowercase")}
                          </li>
                          <li className="flex items-center gap-1.5">
                            {c.hasNumber ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-auth-form-input-border shrink-0 inline-block" />}
                            {t("authPasswordRequirementNumber")}
                          </li>
                        </ul>
                      </div>
                    );
                  })()}
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  disabled={loading}
                  className="w-full h-11 font-medium"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isLogin ? (
                    t("authSignInButton")
                  ) : (
                    t("authSignUpButton")
                  )}
                </Button>
              </form>

              {/* Toggle Auth Mode */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setSignupEmailSent(false);
                    setResendCooldown(0);
                  }}
                  className="text-sm text-auth-form-text-muted hover:text-auth-form-text transition-colors"
                >
                  {isLogin ? (
                    <>
                      {t("authNoAccount")}{" "}
                      <span className="text-primary font-medium">{t("authSignUpLink")}</span>
                    </>
                  ) : (
                    <>
                      {t("authHaveAccount")}{" "}
                      <span className="text-primary font-medium">{t("authSignInLink")}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-auth-form-text-muted/60">
              {t("authFooterPrefix")} · {latestChangelogVersion}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Auth;
