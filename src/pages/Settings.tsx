// q-disable DS-COLOR-001 (decorative brand violet gradients for avatar fallback and MCP icon — visual identity elements, not semantic state tokens)
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorState } from "@/components/ui/error-state";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  LogOut,
  Mail,
  KeyRound,
  CheckCircle2,
  Loader2,
  Trash2,
  Cookie,
  Globe,
  Plug,
  User,
  Shield,
  Info,
  BookOpen,
  MessageCircle,
  Camera,
  Copy,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIntegrationStatus, useInitiateOAuth, useMcpRevoke } from "@/hooks/use-integrations";
import { disconnectIntegration } from "@/services/integration.service";
import { McpSetupModal } from "@/components/McpSetupModal";
import { MCP_URL } from "@/lib/api";
import { usePublicProfile, useUpdateDisplayName, useUploadAvatar, useRemoveAvatar } from "@/hooks/use-profile";
import { Separator } from "@/components/ui/separator";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { acceptCookies, declineCookies, hasConsentDecision, resetCookieBanner } from "@/lib/posthog";
import Logo from "@/components/Logo";
import AppVersionBadge from "@/components/AppVersionBadge";
import { useTourState } from "@/contexts/TourStateContext";
import { ContactForm } from "@/components/ContactForm";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { AiProvidersSettings } from "@/components/settings/AiProvidersSettings";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIGMA_PLUGIN_URL } from "@/lib/constants";

const Settings = () => {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const queryClient = useQueryClient();
  const { resetAllTours } = useTourState();
  const [searchParams, setSearchParams] = useSearchParams();
  const debugMode = searchParams.get("debug") === "1";
  const decodeJwtPayload = (jwt?: string | null): Record<string, unknown> | null => {
    try {
      if (!jwt) return null;
      const payload = jwt.split(".")[1];
      if (!payload) return null;
      const norm = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      // intentional: malformed JWT or non-base64 payload — caller treats null as "no claims"
      return null;
    }
  };
  const tokenClaims = decodeJwtPayload(session?.access_token);

  // Password reset
  const [sendingReset, setSendingReset] = useState(false);

  // Integrations
  const {
    data: integrationStatus,
    isLoading: loadingIntegrations,
    isError: integrationStatusIsError,
    error: integrationStatusError,
    status: integrationStatusQueryStatus,
    fetchStatus: integrationStatusFetchStatus,
    isFetching: integrationStatusIsFetching,
    failureCount: integrationStatusFailureCount,
    refetch: refetchIntegrationStatus,
  } = useIntegrationStatus();
  const initiateOAuth = useInitiateOAuth();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<"notion" | "google_drive" | "figma" | null>(null);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const mcpRevoke = useMcpRevoke();
  const [mcpRevokeConfirmOpen, setMcpRevokeConfirmOpen] = useState(false);
  const [mcpSetupOpen, setMcpSetupOpen] = useState(false);
  const [mcpConfigOpen, setMcpConfigOpen] = useState(false);

  // Profile
  const { data: ownProfile } = usePublicProfile(user?.id);
  const updateDisplayNameMutation = useUpdateDisplayName();
  const uploadAvatarMutation = useUploadAvatar();
  const removeAvatarMutation = useRemoveAvatar();

  const [displayNameInput, setDisplayNameInput] = useState(
    ownProfile?.display_name ?? ""
  );
  useEffect(() => {
    if (ownProfile?.display_name && !displayNameInput) {
      setDisplayNameInput(ownProfile.display_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownProfile?.display_name]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAvatarMutation.mutateAsync(file);
      toast.success(t("displayNameSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? t(err.message as never) ?? t("errorGeneric") : t("errorGeneric"));
    }
    e.target.value = "";
  };

  const handleDisplayNameSave = async () => {
    try {
      await updateDisplayNameMutation.mutateAsync(displayNameInput);
      toast.success(t("displayNameSaved"));
    } catch {
      toast.error(t("errorGeneric"));
    }
  };

  const handleAvatarRemove = async () => {
    try {
      await removeAvatarMutation.mutateAsync();
      toast.success(t("avatarRemoved"));
    } catch {
      toast.error(t("errorGeneric"));
    }
  };

  // Delete account
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Handle OAuth return on Settings page
  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");
    if (integration && status === "success") {
      toast.success(t("integrationConnectSuccess"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.status() });
      const next = new URLSearchParams(searchParams);
      next.delete("integration");
      next.delete("status");
      setSearchParams(next, { replace: true });
    }
    if (integration && status === "error") {
      const message = searchParams.get("message") || "Connection failed";
      toast.error(message);
      const next = new URLSearchParams(searchParams);
      next.delete("integration");
      next.delete("status");
      next.delete("message");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient, t]);

  // Also handle sessionStorage oauth_return = "settings"
  useEffect(() => {
    try {
      const returnTo = sessionStorage.getItem("oauth_return");
      const integration = searchParams.get("integration");
      const status = searchParams.get("status");
      if (returnTo === "settings" && integration && status === "success") {
        sessionStorage.removeItem("oauth_return");
      }
    } catch {
      // ignore
    }
  }, [searchParams]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/home");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign out failed";
      toast.error(msg);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success(t("passwordResetSent"));
    } catch {
      toast.error(t("passwordResetError"));
    } finally {
      setSendingReset(false);
    }
  };

  // Disconnect integration
  const handleDisconnect = async (provider: "notion" | "google_drive" | "figma") => {
    if (!user?.id) return;
    setDisconnecting(provider);
    try {
      // Map Settings UI provider key to IntegrationProvider in the service
      const integrationProvider = provider === "google_drive" ? "drive" : provider;
      await disconnectIntegration(integrationProvider);
      const successMsg = provider === "notion" ? t("notionDisconnected")
        : provider === "figma" ? t("figmaDisconnected")
        : t("driveDisconnected");
      toast.success(successMsg);
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.status() });
    } catch {
      const errorMsg = provider === "notion" ? t("notionDisconnectError")
        : provider === "figma" ? t("figmaDisconnectError")
        : t("driveDisconnectError");
      toast.error(errorMsg);
    } finally {
      setDisconnecting(null);
    }
  };

  // Cookie consent state version to force re-render after accept/revoke
  const [cookieConsentVersion, setCookieConsentVersion] = useState(0);

  // Withdraw cookie consent (set to declined; banner will not reappear until reset)
  const handleRevokeCookies = () => {
    declineCookies();
    setCookieConsentVersion((v) => v + 1);
    toast.success(t("cookieConsentRevoked"));
  };

  // Grant cookie consent (from Settings when user never accepted or had declined)
  const handleAcceptCookies = () => {
    acceptCookies();
    setCookieConsentVersion((v) => v + 1);
    toast.success(t("cookieConsentGranted"));
  };

  // Reset saved choice so the cookie banner shows again on next visit
  const handleResetCookieBanner = () => {
    resetCookieBanner();
    setCookieConsentVersion((v) => v + 1);
    toast.success(t("cookieConsentResetToast"));
  };

  // Restart product tour and go to dashboard
  const handleRestartTutorial = () => {
    resetAllTours();
    toast.success(t("tutorialRestarted"));
    navigate("/dashboard");
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!resp.ok) throw new Error("Delete failed");
      toast.success(t("accountDeleted"));
      await signOut();
      navigate("/home");
    } catch {
      toast.error(t("deleteAccountError"));
    } finally {
      setDeletingAccount(false);
      setDeleteDialogOpen(false);
    }
  };

  const hasCookieConsent =
    cookieConsentVersion >= 0 && hasConsentDecision() && localStorage.getItem("cookie-consent") === "true";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-border glass">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Link to="/dashboard" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              <Logo size="md" />
            </Link>
            <AppVersionBadge />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-10 max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">{t("dashboard")}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t("settings")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div>
            <h1 className="text-3xl font-bold">{t("settings")}</h1>
            <p className="text-muted-foreground mt-1">{t("settingsDesc")}</p>
          </div>
        </div>

        <Tabs defaultValue={searchParams.get("tab") ?? "account"} className="space-y-8">
          <TabsList className="w-full flex justify-between overflow-x-auto">
            <TabsTrigger value="account" className="flex-shrink-0">{t("accountSection")}</TabsTrigger>
            <TabsTrigger value="ai-providers" className="flex-shrink-0">{t("aiProvidersTab")}</TabsTrigger>
            <TabsTrigger value="integrations" className="flex-shrink-0">{t("integrationsSection")}</TabsTrigger>
            <TabsTrigger value="team" className="flex-shrink-0">{t("teamTabLabel")}</TabsTrigger>
            <TabsTrigger value="contact" className="flex-shrink-0">{t("contactSection")}</TabsTrigger>
            <TabsTrigger value="privacy" className="flex-shrink-0">{t("privacySection")}</TabsTrigger>
            <TabsTrigger value="danger" className="flex-shrink-0 data-[state=active]:text-red-400">
              {t("dangerSection")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-10">
        {/* ── Account ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t("accountSection")}
          </h2>
          <div className="glass rounded-xl p-5 space-y-4 border border-border">
            {/* Profile */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {/* Avatar widget */}
                <div
                  className="relative group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={handleAvatarClick}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleAvatarClick();
                    }
                  }}
                  aria-label="Change avatar"
                >
                  {ownProfile?.avatar_url ? (
                    <img
                      src={ownProfile.avatar_url}
                      alt={ownProfile.display_name ?? "avatar"}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    // q-disable-next-line DS-COLOR-001 (decorative avatar fallback gradient — no semantic state, purely visual placeholder)
                    // eslint-disable-next-line qualia-compliance/ds-color-001-no-raw-palette -- decorative avatar fallback gradient, no semantic state
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center text-white font-bold text-lg">
                      {(ownProfile?.display_name ?? user?.email ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadAvatarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Camera className="h-4 w-4 text-white" />
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  aria-label={t("avatarUploadHint")}
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                {/* Name + source */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ownProfile?.display_name ?? user?.email?.split("@")[0] ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.app_metadata?.provider === "google"
                      ? t("avatarSyncedGoogle")
                      : ownProfile?.avatar_url
                      ? t("avatarCustom")
                      : t("avatarUploadHint")}
                  </p>
                  {ownProfile?.avatar_url && (
                    <div className="flex gap-3 mt-1">
                      <button
                        onClick={handleAvatarClick}
                        className="text-xs text-primary hover:underline"
                      >
                        {t("avatarChange")}
                      </button>
                      <button
                        onClick={handleAvatarRemove}
                        disabled={removeAvatarMutation.isPending}
                        className="text-xs text-red-400 hover:underline"
                      >
                        {t("avatarRemove")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Display name input */}
              <div className="space-y-1">
                <Label htmlFor="settings-display-name" className="text-sm text-muted-foreground">{t("displayNameLabel")}</Label>
                <div className="flex gap-2">
                  {/* eslint-disable-next-line no-restricted-syntax, jsx-a11y/control-has-associated-label -- DS-PRIMITIVE-003: legacy raw input pending migration; sibling <Label htmlFor="settings-display-name"> provides the accessible name but jsx-a11y doesn't recognise the Radix-backed Label wrapper */}
                  <input
                    id="settings-display-name"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder={user?.email?.split("@")[0] ?? t("displayNamePlaceholder")}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    size="sm"
                    onClick={handleDisplayNameSave}
                    disabled={updateDisplayNameMutation.isPending || !displayNameInput.trim()}
                  >
                    {updateDisplayNameMutation.isPending ? t("saving") : t("save")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("displayNameDesc")}</p>
              </div>
            </div>
            <Separator />
            {/* Email */}
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {t("emailLabel")}
              </Label>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
            {/* Password */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> {t("passwordLabel")}
              </Label>
              <p className="text-xs text-muted-foreground">{t("passwordDesc")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasswordReset}
                disabled={sendingReset}
              >
                {sendingReset && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                {t("sendPasswordReset")}
              </Button>
            </div>
          </div>
        </section>

        {/* ── Language ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {t("languageSection")}
          </h2>
          <div className="glass rounded-xl p-5 border border-border space-y-2">
            <p className="text-sm text-muted-foreground">{t("languageDesc")}</p>
            <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "it")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* ── Product tour ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {t("tutorialSection")}
          </h2>
          <div className="glass rounded-xl p-5 border border-border space-y-2">
            <p className="text-sm text-muted-foreground">{t("tutorialDesc")}</p>
            <Button variant="outline" size="sm" onClick={handleRestartTutorial}>
              {t("restartTutorial")}
            </Button>
          </div>
        </section>
          </TabsContent>

          <TabsContent value="ai-providers" className="space-y-6">
            <AiProvidersSettings />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-10">
        {/* ── Integrations ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            {t("integrationsSection")}
          </h2>
          <div className="glass rounded-xl p-5 space-y-5 border border-border">
            {integrationStatusIsError ? (
              <ErrorState
                message="Couldn't load integration status"
                onRetry={() => void refetchIntegrationStatus()}
              />
            ) : (
            <>
            {debugMode && (
              <div className="rounded-md border border-amber-300/40 bg-amber-50/10 px-3 py-2 text-xs text-amber-700">
                supabase={import.meta.env.VITE_SUPABASE_URL} | user={user?.id ?? "none"} | status=
                {integrationStatus ? JSON.stringify(integrationStatus) : loadingIntegrations ? "loading" : "none"} | err=
                {integrationStatusIsError ? (integrationStatusError instanceof Error ? integrationStatusError.message : "unknown") : "none"} |
                q={integrationStatusQueryStatus}/{integrationStatusFetchStatus} fetching=
                {integrationStatusIsFetching ? "1" : "0"} failures={integrationStatusFailureCount} | iss=
                {String(tokenClaims?.iss ?? "none")} | exp=
                {tokenClaims?.exp ? `${tokenClaims.exp} (${Math.round((Number(tokenClaims.exp) - Date.now() / 1000) / 60)}m left)` : "none"}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => { void refetchIntegrationStatus(); }}
                >
                  refetch
                </button>
              </div>
            )}
            {/* Figma */}
            <IntegrationRow
              label={t("figmaLabel")}
              connected={integrationStatus?.figma ?? false}
              loading={loadingIntegrations}
              connectLabel={t("connectFigma")}
              disconnectLabel={t("disconnectFigma")}
              reconnectLabel={t("reconnectIntegration")}
              disconnecting={disconnecting === "figma"}
              onConnect={() => initiateOAuth.mutate({ provider: "figma", returnTo: "settings" })}
              onDisconnect={() => { setDisconnectTarget("figma"); setDisconnectConfirmOpen(true); }}
              onReconnect={() => initiateOAuth.mutate({ provider: "figma", returnTo: "settings" })}
              connecting={initiateOAuth.isPending}
              permissionHint={t("integrationPermissionHint")}
              accountName={integrationStatus?.accounts?.figma}
              connectedFallback={t("integrationConnectedFallback")}
            />
            {/* CTA F: plugin link below Figma card */}
            <a
              href={FIGMA_PLUGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary text-xs hover:underline transition-colors -mt-2 ml-1"
            >
              <Plug className="h-3 w-3" />
              {t("pluginCtaBannerSettings")}
            </a>

            <hr className="border-border" />

            {/* Notion */}
            <IntegrationRow
              label={t("notionLabel")}
              connected={integrationStatus?.notion ?? false}
              loading={loadingIntegrations}
              connectLabel={t("connectNotion")}
              disconnectLabel={t("disconnectNotion")}
              reconnectLabel={t("reconnectIntegration")}
              disconnecting={disconnecting === "notion"}
              onConnect={() => initiateOAuth.mutate({ provider: "notion", returnTo: "settings" })}
              onDisconnect={() => { setDisconnectTarget("notion"); setDisconnectConfirmOpen(true); }}
              onReconnect={() => initiateOAuth.mutate({ provider: "notion", returnTo: "settings" })}
              connecting={initiateOAuth.isPending}
              permissionHint={t("integrationPermissionHint")}
              accountName={integrationStatus?.accounts?.notion}
              connectedFallback={t("integrationConnectedFallback")}
            />

            <hr className="border-border" />

            {/* Google Drive */}
            <IntegrationRow
              label={t("driveLabel")}
              connected={integrationStatus?.drive ?? false}
              loading={loadingIntegrations}
              connectLabel={t("connectDrive")}
              disconnectLabel={t("disconnectDrive")}
              reconnectLabel={t("reconnectIntegration")}
              disconnecting={disconnecting === "google_drive"}
              onConnect={() => initiateOAuth.mutate({ provider: "drive", returnTo: "settings" })}
              onDisconnect={() => { setDisconnectTarget("google_drive"); setDisconnectConfirmOpen(true); }}
              onReconnect={() => initiateOAuth.mutate({ provider: "drive", returnTo: "settings" })}
              connecting={initiateOAuth.isPending}
              permissionHint={t("integrationPermissionHint")}
              accountName={integrationStatus?.accounts?.drive}
              connectedFallback={t("integrationConnectedFallback")}
            />
            </>
            )}

          </div>
        </section>

        {/* ── MCP ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            {t("mcpSection")}
          </h2>
          <div className="glass rounded-xl p-5 space-y-5 border border-border">
            {/* Claude (MCP) */}
            <div className={`rounded-lg border p-4 flex items-center justify-between gap-3 ${integrationStatus?.mcp ? "border-border" : "border-primary/30 bg-primary/5"}`}>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line qualia-compliance/ds-color-001-no-raw-palette -- decorative MCP/Claude logo gradient, no semantic state */}
                <div className="h-7 w-7 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm">🤖</div>
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {t("mcpClaudeLabel")}
                    {!integrationStatus?.mcp && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">{t("mcpNewBadge")}</span>
                    )}
                  </p>
                  {integrationStatus?.mcp ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                      {t("mcpConnectedDesc")}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("mcpNotConnectedDesc")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {integrationStatus?.mcp ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setMcpConfigOpen(v => !v)}>
                      {t("mcpConfigure")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={mcpRevoke.isPending}
                      onClick={() => setMcpRevokeConfirmOpen(true)}
                    >
                      {mcpRevoke.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("mcpRevoke")}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setMcpSetupOpen(true)}>
                    {t("mcpConnect")}
                  </Button>
                )}
              </div>
            </div>

            {/* Claude config panel */}
            {integrationStatus?.mcp && mcpConfigOpen && (
              <div className="rounded-b-lg border border-t-0 border-border bg-muted/30 px-4 py-3 -mt-2 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{t("mcpConfigHint")}</p>
                <div className="flex items-center gap-2 bg-background rounded border border-border px-3 py-2">
                  <code className="text-xs text-foreground flex-1 overflow-x-auto">{MCP_URL}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Copy MCP URL" onClick={() => {
                    void navigator.clipboard.writeText(MCP_URL);
                    toast.success(t("mcpUrlCopied"));
                  }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Button variant="link" size="sm" className="self-start h-auto p-0 text-xs" onClick={() => setMcpSetupOpen(true)}>
                  {t("mcpSetupInstructions")}
                </Button>
              </div>
            )}
          </div>
        </section>

        <McpSetupModal open={mcpSetupOpen} onOpenChange={setMcpSetupOpen} />
          </TabsContent>

          <TabsContent value="team" className="space-y-10">
            <TeamSettings />
          </TabsContent>

          <TabsContent value="contact" className="space-y-10">
        {/* ── Contact ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {t("contactSection")}
          </h2>
          <div className="glass rounded-xl p-5 border border-border">
            <p className="text-sm text-muted-foreground mb-4">{t("contactSectionDesc")}</p>
            <ContactForm
              skipEmail
              userEmail={user?.email ?? ""}
              showHeader={false}
            />
          </div>
        </section>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-10">
        {/* ── Privacy ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t("privacySection")}
          </h2>
          <div className="glass rounded-xl p-5 border border-border space-y-3">
            <div className="space-y-1">
              <Label className="text-sm flex items-center gap-1.5">
                <Cookie className="h-3.5 w-3.5 text-muted-foreground" /> {t("cookieConsentLabel")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {hasCookieConsent ? t("cookieConsentDesc") : t("cookieConsentNotGranted")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {hasCookieConsent ? (
                <Button variant="outline" size="sm" onClick={handleRevokeCookies}>
                  {t("revokeCookieConsent")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleAcceptCookies}>
                  {t("acceptCookieConsent")}
                </Button>
              )}
              {(hasCookieConsent || localStorage.getItem("cookie-consent") === "false") ? (
                <Button variant="outline" size="sm" onClick={handleResetCookieBanner}>
                  {t("resetCookieBanner")}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" asChild>
                <Link to="/cookies" className="inline-flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  {t("manageCookiesLink")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
          </TabsContent>

          <TabsContent value="danger" className="space-y-10">
        {/* ── Danger Zone ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-red-400">
            <Trash2 className="h-5 w-5" />
            {t("dangerSection")}
          </h2>
          <div className="rounded-xl p-5 border border-border space-y-3">
            <p className="text-sm text-muted-foreground">{t("deleteAccountDesc")}</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              {t("deleteAccount")}
            </Button>
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAccountConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteAccountConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={t("deleteAccountTypePlaceholder")}
            className="bg-surface-1 border-border"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("deleteAccountButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect integration confirm dialog */}
      <AlertDialog open={disconnectConfirmOpen} onOpenChange={(open) => { setDisconnectConfirmOpen(open); if (!open) setDisconnectTarget(null); }}>
        <AlertDialogContent className="glass border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disconnectTarget === "figma" && "Disconnect Figma?"}
              {disconnectTarget === "notion" && "Disconnect Notion?"}
              {disconnectTarget === "google_drive" && "Disconnect Google Drive?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disconnectTarget === "figma" && "Active audits using Figma data may stop working."}
              {disconnectTarget === "notion" && "Linked context documents will become unreachable."}
              {disconnectTarget === "google_drive" && "Linked context documents will become unreachable."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => {
                  if (disconnectTarget) void handleDisconnect(disconnectTarget);
                  setDisconnectConfirmOpen(false);
                  setDisconnectTarget(null);
                }}
              >
                Disconnect
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MCP revoke confirm dialog */}
      <AlertDialog open={mcpRevokeConfirmOpen} onOpenChange={setMcpRevokeConfirmOpen}>
        <AlertDialogContent className="glass border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Claude access?</AlertDialogTitle>
            <AlertDialogDescription>
              Your AI assistant will lose access to Qualia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => {
                  mcpRevoke.mutate();
                  setMcpRevokeConfirmOpen(false);
                }}
              >
                Revoke
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Sub-component for Notion / Drive rows ──
interface IntegrationRowProps {
  label: string;
  connected: boolean;
  loading: boolean;
  connectLabel: string;
  disconnectLabel: string;
  reconnectLabel: string;
  disconnecting: boolean;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  note?: string;
  permissionHint?: string;
  accountName?: string | null;
  connectedFallback?: string;
}

function IntegrationRow({
  label,
  connected,
  loading,
  connectLabel,
  disconnectLabel,
  reconnectLabel,
  disconnecting,
  connecting,
  onConnect,
  onDisconnect,
  onReconnect,
  note,
  permissionHint,
  accountName,
  connectedFallback,
}: IntegrationRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : connected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {accountName ? accountName : connectedFallback}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onReconnect}
              disabled={connecting}
              className="text-xs h-7"
            >
              {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : reconnectLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              disabled={disconnecting}
              className="text-xs h-7 text-red-400 hover:text-red-400"
            >
              {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : disconnectLabel}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={onConnect} disabled={connecting} className="text-xs h-7">
            {connecting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            {connectLabel}
          </Button>
        )}
      </div>
      {connected && permissionHint && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" /> {permissionHint}
        </p>
      )}
      {note && !connected && (
        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" /> {note}
        </p>
      )}
    </div>
  );
}

export default Settings;
