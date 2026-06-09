import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, LogOut, FolderOpen, Clock, Activity, Trash2, BarChart3, Settings, Filter, Users, ArrowLeftRight, Lock, Plug, Sparkles, Key } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import NewProjectDialog from "@/components/NewProjectDialog";
import TransferProjectDialog from "@/components/TransferProjectDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SetupMode } from "@/components/project-setup/SetupForkScreen";
import { FEATURE_DRIVE_NOTION_IMPORT } from "@/lib/feature-flags";
import { useLanguage } from "@/contexts/LanguageContext";
import { it as itLocale } from "date-fns/locale";
import Logo from "@/components/Logo";
import AppVersionBadge from "@/components/AppVersionBadge";
import { useDashboardTour, useProjectCreatedTour } from "@/hooks/use-product-tour";
import { useUserAuditCapability } from "@/hooks/use-user-audit-capability";
import { TourBridge } from "@/components/TourBridge";
import { useProjects, useDeleteProject, useTransferProject, type Project } from "@/hooks/use-projects";
import { ErrorState } from "@/components/ui/error-state";
import { useMyOrganization, useCreateOrganization } from "@/hooks/use-organizations";
import { Input } from "@/components/ui/input";
import type { ProjectScope } from "@/services/project.service";
import { useViewScope } from "@/hooks/use-view-scope";
import { useProjectAuditStats } from "@/hooks/use-project-audit-stats";
import { formatRelativeTime } from "@/lib/dateFormat";
import "@/styles/tour.css";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { canManageProject } from "@/utils/permissions";
import { OwnerBadge } from "@/components/OwnerBadge";
import { FIGMA_PLUGIN_URL } from "@/lib/constants";
import { PluginCTABanner } from "@/components/PluginCTABanner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const dateFnsLocale = language === "it" ? itLocale : undefined;
  const { user, signOut } = useAuth();
  const { startTour, destroyTour } = useDashboardTour();
  const { startTour: startProjectCreatedTour, destroyTour: destroyProjectCreatedTour } = useProjectCreatedTour();
  const { data: auditCap } = useUserAuditCapability();
  const { data: org } = useMyOrganization();
  const createOrg = useCreateOrganization();
  const [newTeamName, setNewTeamName] = useState("");
  const [projectScope, setProjectScope] = useViewScope() as [ProjectScope, (s: ProjectScope) => void];
  const orgId = projectScope === "team" ? (org?.id ?? null) : null;
  const { data: projects = [], isLoading: loading, isError: projectsIsError, error: projectsError, refetch: refetchProjects } = useProjects(projectScope, orgId);
  const deleteProject = useDeleteProject();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const { data: auditStats } = useProjectAuditStats(projectIds);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialSetupMode, setInitialSetupMode] = useState<SetupMode | undefined>(undefined);
  const [initialFromPlugin, setInitialFromPlugin] = useState<{
    scope: "whole" | "section";
    productName: string;
    sectionName?: string;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const transferMutation = useTransferProject();
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferDirection, setTransferDirection] = useState<"to-team" | "to-personal">("to-team");
  const [projectToTransfer, setProjectToTransfer] = useState<Project | null>(null);

  // Filter: whole product vs section; when section, optional filter by product name
  type ScopeFilter = "all" | "whole" | "section";
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const ALL_PRODUCTS_VALUE = "__all__";
  const [productNameFilter, setProductNameFilter] = useState<string>(ALL_PRODUCTS_VALUE);

  // Filter by stored scope (set when project was created in the modal), not by name parsing
  const { sectionProjects, productNames, filteredProjects } = useMemo(() => {
    const section = projects.filter((p) => p.scope === "section");
    const names = Array.from(
      new Set(section.map((p) => p.product_name).filter((n): n is string => Boolean(n)))
    ).sort();
    let list = projects;
    if (scopeFilter === "whole") list = list.filter((p) => p.scope === "whole");
    if (scopeFilter === "section") list = list.filter((p) => p.scope === "section");
    if (scopeFilter === "section" && productNameFilter && productNameFilter !== ALL_PRODUCTS_VALUE) {
      list = list.filter((p) => p.product_name === productNameFilter);
    }
    return { sectionProjects: section, productNames: names, filteredProjects: list };
  }, [projects, scopeFilter, productNameFilter]);

  // When switching to "all" or "whole", clear product name filter
  const handleScopeFilterChange = (value: ScopeFilter) => {
    setScopeFilter(value);
    if (value !== "section") setProductNameFilter(ALL_PRODUCTS_VALUE);
  };

  // Reopen New Project modal in import mode after OAuth return
  useEffect(() => {
    const openMode = searchParams.get("openNewProject");
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");
    const isOAuthSuccess =
      (integration === "google_drive" || integration === "notion") && status === "success";

    try {
      const returnTo = sessionStorage.getItem("oauth_return");
      if (isOAuthSuccess && returnTo === "new-project-import") {
        sessionStorage.removeItem("oauth_return");
        const next = new URLSearchParams(searchParams);
        next.delete("integration");
        next.delete("status");
        next.set("openNewProject", "import");
        setSearchParams(next, { replace: true });
        setDialogOpen(true);
        setInitialSetupMode(FEATURE_DRIVE_NOTION_IMPORT ? "import" : undefined);
        return;
      }
    } catch {
      // ignore
    }

    if (openMode === "import") {
      setDialogOpen(true);
      setInitialSetupMode(FEATURE_DRIVE_NOTION_IMPORT ? "import" : undefined);
      const next = new URLSearchParams(searchParams);
      next.delete("openNewProject");
      setSearchParams(next, { replace: true });
      return;
    }

    if (openMode === "create") {
      setDialogOpen(true);
      const scope = searchParams.get("scope") === "section" ? "section" : "whole";
      const productName = searchParams.get("productName")?.trim() ?? "";
      const sectionName = searchParams.get("sectionName")?.trim();
      if (productName) {
        setInitialFromPlugin({
          scope,
          productName,
          ...(scope === "section" && sectionName ? { sectionName } : {}),
        });
      }
      const next = new URLSearchParams(searchParams);
      next.delete("openNewProject");
      next.delete("scope");
      next.delete("productName");
      next.delete("sectionName");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Start dashboard tour (gated inside the hook by shouldShowTour).
  // Auto-fire protection for existing users is handled by the
  // 20260515180000_backfill_tour_completions migration, which marks all
  // pre-existing users' tours as completed. After that, this fires only for
  // brand-new users on first visit or anyone who clicks Restart in Settings.
  useEffect(() => {
    if (!loading && user) {
      startTour();
    }
    return () => destroyTour();
  }, [loading, user, startTour, destroyTour]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      // In development/localhost, still allow navigation even if Supabase returns an error
       
      console.error("Error signing out", error);
    } finally {
      navigate("/home", { replace: true });
    }
  };

  const handleProjectCreated = (projectId?: string) => {
    setDialogOpen(false);
    setInitialSetupMode(undefined);
    if (projectId) {
      toast.success('Project created — add your first prototype to get started');
      navigate(`/project/${projectId}`);
    } else {
      setTimeout(() => startProjectCreatedTour(), 300);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setInitialSetupMode(undefined);
      setInitialFromPlugin(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleTransferClick = (e: React.MouseEvent, project: Project, direction: "to-team" | "to-personal") => {
    e.preventDefault();
    e.stopPropagation();
    if (transferMutation.isPending) return;
    setProjectToTransfer(project);
    setTransferDirection(direction);
    setTransferDialogOpen(true);
  };

  const handleTransferConfirm = async () => {
    if (!projectToTransfer) return;
    const orgId = transferDirection === "to-team" ? (org?.id ?? null) : null;
    try {
      await transferMutation.mutateAsync({ projectId: projectToTransfer.id, orgId });
      toast.success(
        transferDirection === "to-team"
          ? t("projectTransferredToTeam").replace("{{teamName}}", org?.name ?? "")
          : t("projectMadePrivate")
      );
      setTransferDialogOpen(false);
      setProjectToTransfer(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject.mutateAsync(projectToDelete);
      toast.success(t("projectDeletedSuccess"));
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("errorGeneric"));
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Happy path bridges */}
      <TourBridge
        bridgeName="after_dashboard"
        targetSelector='[data-tour="create-project"]'
        label="Create your first project to get started"
        position="bottom"
      />
      <TourBridge
        bridgeName="after_project_created"
        targetSelector='[data-tour="project-card"]'
        label="Open it to start your first audit"
        position="bottom"
      />

      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-border glass">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              <Logo size="md" />
            </Link>
            <AppVersionBadge />
          </div>

          <div className="flex items-center gap-2">
            {/* CTA D: ambient plugin pill — always visible */}
            <a
              href={FIGMA_PLUGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Plug className="h-3 w-3" />
              {t("pluginCtaBannerDashboardPill")}
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("settings")}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{t("dashboard")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t("yourProjects")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("manageAndAudit")}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/analytics")}
              className="border-border"
              data-tour="statistics"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {t("analytics")}
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 glow-purple"
              data-tour="create-project"
            >
              <Plus className="h-4 w-4" />
              {t("newProject")}
            </Button>
          </div>
        </div>

        {projectsIsError ? (
          <ErrorState
            message={projectsError instanceof Error ? projectsError.message : "Couldn't load your projects"}
            onRetry={() => void refetchProjects()}
          />
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-surface-1 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              {/* Left: Personal / Team toggle */}
              <div className="flex bg-surface-1 border border-border rounded-lg p-1 gap-1">
                <button
                  onClick={() => setProjectScope("personal")}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    projectScope === "personal"
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("togglePersonal")}
                </button>
                <button
                  onClick={() => setProjectScope("team")}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    projectScope === "team"
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {org ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {org.name}
                    </>
                  ) : (
                    t("toggleTeam")
                  )}
                </button>
              </div>

              {/* Right: existing scope filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={scopeFilter} onValueChange={(v) => handleScopeFilterChange(v as ScopeFilter)}>
                  <SelectTrigger className="w-[180px] bg-surface-1 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">{t("filterAll")}</SelectItem>
                    <SelectItem value="whole">{t("filterWholeProduct")}</SelectItem>
                    <SelectItem value="section">{t("filterSection")}</SelectItem>
                  </SelectContent>
                </Select>
                {scopeFilter === "section" && productNames.length > 0 && (
                  <Select value={productNameFilter} onValueChange={setProductNameFilter}>
                    <SelectTrigger className="w-[200px] bg-surface-1 border-border">
                      <SelectValue placeholder={t("filterByProduct")} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value={ALL_PRODUCTS_VALUE}>{t("filterAllProducts")}</SelectItem>
                      {productNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {projectScope === "team" && !org ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center mb-6">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t("teamEmptyTitle")}</h2>
                <p className="text-muted-foreground mb-4 max-w-md">{t("teamEmptyDesc")}</p>
                <div className="flex gap-2 w-full max-w-sm">
                  <Input
                    placeholder={t("teamName")}
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="bg-surface-1 border-border"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTeamName.trim()) {
                        createOrg.mutate(newTeamName.trim(), {
                          onSuccess: () => setNewTeamName(""),
                          onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create team'),
                        });
                      }
                    }}
                  />
                  <Button
                    onClick={() => createOrg.mutate(newTeamName.trim(), {
                      onSuccess: () => setNewTeamName(""),
                      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create team'),
                    })}
                    disabled={!newTeamName.trim() || createOrg.isPending}
                    className="bg-primary hover:bg-primary/90 whitespace-nowrap"
                  >
                    {t("teamCreateButton")}
                  </Button>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center mb-6">
                  <FolderOpen className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{t("noProjectsYet")}</h2>
                <p className="text-muted-foreground mb-3 max-w-md">
                  {t("createFirstProjectDesc")}
                </p>
                {/* BYOK trial-state hint — only for users without keys */}
                {auditCap?.kind === "trial" && (
                  <p className="text-xs text-foreground/75 mb-5 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    {auditCap.trialAvailable
                      ? t("byokOnboardingHint")
                      : t("byokOnboardingHintUsed")}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    onClick={() => setDialogOpen(true)}
                    className="bg-primary hover:bg-primary/90 glow-purple"
                  >
                    <Plus className="h-4 w-4" />
                    {t("createYourFirstProject")}
                  </Button>
                  {auditCap?.kind === "trial" && (
                    <Button
                      variant="outline"
                      onClick={() => navigate("/settings?tab=ai-providers")}
                    >
                      <Key className="h-4 w-4" />
                      {t("addAiKeyNow")}
                    </Button>
                  )}
                </div>
                {/* CTA E: plugin link for new users */}
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-xs text-muted-foreground">
                    — {t("pluginCtaBannerOr")} —
                  </span>
                  <a
                    href={FIGMA_PLUGIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary text-sm hover:underline"
                  >
                    <Plug className="h-3.5 w-3.5" />
                    {t("pluginCtaBannerEmptyState")}
                  </a>
                </div>
              </div>
            ) : (
            <>
            <PluginCTABanner
              variant="bold"
              storageKey="plugin_cta_dashboard_populated_dismissed"
              className="mb-6"
              headline="Start audits faster with the Figma plugin"
              body="Run audits directly from Figma — no screenshot uploads needed."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project, index) => (
              <a
                key={project.id}
                href={`/project/${project.id}`}
                onClick={(e) => { e.preventDefault(); navigate(`/project/${project.id}`); }}
                aria-label={project.name}
                className="glass rounded-xl p-6 text-left transition-all hover:glow-border hover:scale-[1.02] group cursor-pointer relative flex flex-col no-underline"
                data-tour={index === 0 ? "project-card" : undefined}
              >
                {/* Action buttons — top-right corner, appear on hover */}
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-30 group-hover:opacity-100 focus-visible:opacity-100 focus-within:opacity-100 transition-opacity [@media(hover:none)]:opacity-100">
                  {!project.org_id && org && (
                    <button
                      onClick={(e) => handleTransferClick(e, project, "to-team")}
                      className="p-2 rounded-lg bg-primary/10 text-primary/80 hover:bg-primary/20 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                      title={t("moveToTeam")}
                      aria-label={t("moveToTeam")}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </button>
                  )}
                  {projectScope === "team" && org && canManageProject(user?.id, project.user_id, org.owner_id) && (
                    <button
                      onClick={(e) => handleTransferClick(e, project, "to-personal")}
                      className="p-2 rounded-lg bg-amber-500/10 text-amber-500/80 hover:bg-amber-500/20 hover:text-amber-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500"
                      title={t("makePrivate")}
                      aria-label={t("makePrivate")}
                    >
                      <Lock className="h-4 w-4" />
                    </button>
                  )}
                  {canManageProject(
                    user?.id,
                    project.user_id,
                    projectScope === "team" ? org?.owner_id : undefined
                  ) && (
                    <button
                      onClick={(e) => handleDeleteClick(e, project)}
                      // q-disable-next-line DS-A11Y-009 (static analysis false positive: linter pairs hover:bg-destructive with text-destructive, but hover state always uses hover:text-destructive-foreground — rest state is bg-destructive/10 text-destructive which is fine)
                      className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive"
                      title={t("deleteProject")}
                      aria-label={t("deleteProject")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors pr-10">
                  {project.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                  {project.mission}
                </p>
                <div className="flex items-center justify-between mt-auto pt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-1">
                    {(() => {
                      const stats = auditStats?.get(project.id);
                      const count = stats?.count ?? 0;
                      const auditLabel = count === 1 ? `1 ${t("auditSingular")}` : `${count} ${t("auditPlural")}`;
                      return stats?.lastAuditAt ? (
                        <>
                          <Clock className="h-3 w-3" />
                          {t("lastAudit")} {formatRelativeTime(stats.lastAuditAt, dateFnsLocale)}
                          <span className="text-muted-foreground/40">·</span>
                          <Activity className="h-3 w-3" />
                          {auditLabel}
                        </>
                      ) : (
                        <>
                          <Activity className="h-3 w-3" />
                          <span className="text-muted-foreground/60">{t("noAuditsYet")}</span>
                          <span className="text-muted-foreground/40">·</span>
                          {auditLabel}
                        </>
                      );
                    })()}
                  </div>
                  {projectScope === "team" && (
                    <OwnerBadge userId={project.user_id} size="md" />
                  )}
                </div>
              </a>
            ))}
            </div>
            </>
            )}
          </>
        )}
      </main>

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleProjectCreated}
        initialSetupMode={initialSetupMode}
        initialFromPlugin={initialFromPlugin}
        initialScope={projectScope}
      />

      {projectToTransfer && org && (
        <TransferProjectDialog
          open={transferDialogOpen}
          onOpenChange={(open) => {
            setTransferDialogOpen(open);
            if (!open) setProjectToTransfer(null);
          }}
          project={projectToTransfer}
          direction={transferDirection}
          org={org}
          onConfirm={handleTransferConfirm}
          isPending={transferMutation.isPending}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass border-border max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteProject")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteProjectConfirm")} "{projectToDelete?.name}"? {t("deleteProjectWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteProject.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProject.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
