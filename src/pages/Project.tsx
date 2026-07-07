import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  uploadScreenshot,
  createScreenshotSignedUrl,
  createScreenshotSignedUrls,
} from "@/services/storage.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Loader2, RefreshCw, Upload, ArrowLeftRight, Lock, Users, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import AuditDetail from "@/components/AuditDetail";
import { useAuth } from "@/contexts/AuthContext";
import EditProjectDialog from "@/components/EditProjectDialog";
import type { Project } from "@/services/project.service";
import UploadModal from "@/components/UploadModal";
import type { UploadPersona } from "@/types/audit";
import type { ContextImageData } from "@/components/audit/SingleScreenForm";
import type { AutoCrawlPayload } from "@/components/audit/AutoCrawlForm";
import type { PrototypeCrawlPayload } from "@/components/audit/PrototypeCrawlForm";
import ProjectContextCard from "@/components/ProjectContextCard";
import {
  ProjectPageHeader,
  ProjectUploadZone,
  ProjectAuditsList,
  DeleteAuditDialog,
} from "@/components/project";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProjectViewTour } from "@/hooks/use-product-tour";
import { TourBridge } from "@/components/TourBridge";
import { useProject } from "@/hooks/use-project";
import {
  useAudits,
  useCreateAudit,
  useDeleteAudit,
  transformAudit,
  type Audit,
} from "@/hooks/use-audits";
import { usePersonas } from "@/hooks/use-personas";
import { useProjectSignedUrls } from "@/hooks/use-project-signed-urls";
import { useAnalyzeScreenshot } from "@/hooks/use-analyze-screenshot";
import { useRunSynth } from "@/hooks/use-run-synth";
import { useAdditionalContext } from "@/hooks/use-context-documents";
import { useMyOrganization } from "@/hooks/use-organizations";
import { useTransferProject, useDeleteProject } from "@/hooks/use-projects";
import TransferProjectDialog from "@/components/TransferProjectDialog";
import { updateAuditReport } from "@/services/audit.service";
import { queryKeys } from "@/lib/query-keys";
import { ANALYZE_UI_URL, CRAWL_REQUEST_URL, FIGMA_PROTOTYPE_CRAWL_URL } from "@/lib/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { canManageProject } from "@/utils/permissions";
import { OwnerBadge } from "@/components/OwnerBadge";
import { ErrorState } from "@/components/ui/error-state";
import { TrialExhaustedDialog } from "@/components/TrialExhaustedDialog";
import { llmErrorToast, type LlmErrorBody } from "@/lib/llmErrorToast";

const Project = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { user, session } = useAuth();
  const { startTour: startProjectViewTour, destroyTour: destroyProjectViewTour } = useProjectViewTour();

  const { data: projectData, isLoading: projectLoading } = useProject(id);
  const project = projectData ?? null;
  const { data: auditsData = [], isError: auditsIsError, error: auditsError, refetch: refetchAudits } = useAudits(id);
  const { data: personasData } = usePersonas(id);
  const createAudit = useCreateAudit(id ?? "");
  const deleteAuditMutation = useDeleteAudit(id ?? "");

  const { getSignedUrl } = useProjectSignedUrls(auditsData);
  const { analyzeScreenshot: analyzeScreenshotFn, analyzing, setAnalyzing } = useAnalyzeScreenshot(project, t);
  const { data: additionalContext } = useAdditionalContext(id);
  const { data: org } = useMyOrganization();
  const transferProjectMutation = useTransferProject();
  const deleteProjectMutation = useDeleteProject();
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferDirection, setTransferDirection] = useState<"to-team" | "to-personal">("to-team");
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [selectedAuditSignedUrl, setSelectedAuditSignedUrl] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<Audit | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "score-desc" | "score-asc">("date-desc");
  const [followUpAuditId, setFollowUpAuditId] = useState<string | null>(null);
  const [isSynthPending, setIsSynthPending] = useState(false);
  const { runSynth } = useRunSynth(setIsSynthPending);
  const [lastFigmaAuditId, setLastFigmaAuditId] = useState<string | null>(null);
  /** When opening modal for re-audit: type, screen goal, and optional user data from the audit we're re-auditing from */
  const [reAuditContext, setReAuditContext] = useState<{
    type: "single" | "flow" | "prototype";
    screenContext: string;
    userData?: string;
    synthPersonaIds?: string[];
  } | null>(null);
  const [reauditChoiceOpen, setReauditChoiceOpen] = useState(false);
  const [auditForReaudit, setAuditForReaudit] = useState<Audit | null>(null);
  const deepLinkAuditApplied = useRef(false);
  const [trialExhaustedOpen, setTrialExhaustedOpen] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<(() => void) | null>(null);

  const loading = projectLoading;

  // Derived: personas for upload modal
  const personas: UploadPersona[] = useMemo(() => {
    if (personasData && personasData.length > 0) {
      return personasData.map((p) => ({ id: p.id, name: p.name, description: p.description }));
    }
    if (project?.persona) {
      return [{ id: "legacy", name: "Default Persona", description: project.persona }];
    }
    return [];
  }, [personasData, project?.persona]);

  // Redirect if project not found
  useEffect(() => {
    if (!projectLoading && id && project === null) {
      toast.error(t("errorGeneric"));
      navigate("/dashboard");
    }
  }, [projectLoading, id, project, navigate, t]);

  // Handle OAuth return (Drive/Notion connect from edit dialog)
  useEffect(() => {
    const integration = searchParams.get("integration");
    const status = searchParams.get("status");
    if ((integration === "google_drive" || integration === "notion") && status === "success") {
      toast.success(t("integrationConnectSuccess"));
      void queryClient.invalidateQueries({ queryKey: queryKeys.integrations.status() });
      try { sessionStorage.removeItem("oauth_return"); } catch { /* ignore */ }
      const next = new URLSearchParams(searchParams);
      next.delete("integration");
      next.delete("status");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient, t]);

  // Deep-link: open a specific audit when URL has ?audit=:auditId (e.g. from Figma plugin "View full report")
  useEffect(() => {
    const auditId = searchParams.get("audit");
    if (!auditId || !id || deepLinkAuditApplied.current) return;
    const audit = auditsData.find((a) => a.id === auditId);
    if (!audit) return;
    deepLinkAuditApplied.current = true;
    setSelectedAudit(audit);
    const pathOrUrl = audit.screenshot_url;
    if (!pathOrUrl) {
      setSelectedAuditSignedUrl("/placeholder.svg");
      return;
    }
    if (pathOrUrl.startsWith("http")) {
      setSelectedAuditSignedUrl(pathOrUrl);
      return;
    }
    void createScreenshotSignedUrl(pathOrUrl, 3600).then((signed) => {
      setSelectedAuditSignedUrl(signed ?? "/placeholder.svg");
    });
  }, [id, searchParams, auditsData]);

  // Clear pending flag when user switches to a different audit — the synth run
  // (if any) belongs to the previous audit and shouldn't be displayed on this one.
  useEffect(() => {
    setIsSynthPending(false);
  }, [selectedAudit?.id]);

  // Sync selectedAudit from auditsData when synth analysis completes and merges synth_users into the DB
  useEffect(() => {
    if (!selectedAudit) return;
    const updated = auditsData.find((a) => a.id === selectedAudit.id);
    if (!updated) return;
    const hadSynth = !!(selectedAudit.ai_report as { synth_users?: unknown } | null)?.synth_users;
    const hasSynth = !!(updated.ai_report as { synth_users?: unknown } | null)?.synth_users;
    if (hasSynth && !hadSynth) {
      setSelectedAudit(updated);
      setIsSynthPending(false);
    }
  }, [auditsData, selectedAudit]);

  // openUploadModal state no longer used (auto-open removed, UX-I-DASHBOARD-001)

  // Start project view tour when page loads
  useEffect(() => {
    if (!loading && project) {
      startProjectViewTour();
    }
    return () => destroyProjectViewTour();
  }, [loading, project, startProjectViewTour, destroyProjectViewTour]);
  // Sort audits based on selected criteria
  const sortedAudits = useMemo(() => {
    const sorted = [...auditsData];
    switch (sortBy) {
      case "date-desc":
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "date-asc":
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case "score-desc":
        return sorted.sort((a, b) => {
          const scoreA = a.overall_score ?? a.ai_report?.score ?? -1;
          const scoreB = b.overall_score ?? b.ai_report?.score ?? -1;
          return scoreB - scoreA;
        });
      case "score-asc":
        return sorted.sort((a, b) => {
          const scoreA = a.overall_score ?? a.ai_report?.score ?? 101;
          const scoreB = b.overall_score ?? b.ai_report?.score ?? 101;
          return scoreA - scoreB;
        });
      default:
        return sorted;
    }
  }, [auditsData, sortBy]);

  // Wrapper that shows toasts and returns boolean for callers that expect it.
  // When the server returns no_key (HTTP 402 + error:"no_key"), opens the
  // TrialExhaustedDialog with `retryFn` as the post-save callback instead of
  // firing a generic toast.
  const analyzeScreenshot = async (
    auditId: string,
    screenshotUrl: string,
    selectedPersonas?: UploadPersona[],
    screenContext?: string,
    contextImageUrls?: string[],
    figmaMetadata?: unknown,
    deepFigmaUiRequested?: boolean,
    userData?: string,
    synthPersonaIds?: string[],
    provider?: import("@/services/llm-key.service").LLMProvider,
    model?: string,
    retryFn?: () => void
  ): Promise<boolean> => {
    const result = await analyzeScreenshotFn(
      auditId,
      screenshotUrl,
      selectedPersonas,
      screenContext,
      contextImageUrls,
      additionalContext || undefined,
      figmaMetadata,
      deepFigmaUiRequested,
      userData,
      synthPersonaIds,
      provider,
      model
    );
    if (result.success) {
      toast.success("Analysis complete!");
      return true;
    }
    if (result.errorKey) {
      if (result.errorKey === "creditsExhaustedError" && result.errorMessage === "no_key") {
        // Trial exhausted or no key configured — open inline BYOK modal instead of toasting
        if (retryFn) setPendingRetry(() => retryFn);
        setTrialExhaustedOpen(true);
        return false;
      }
      if (result.errorKey === "authRequiredError") {
        toast.error("Please log in to analyze screenshots");
      } else if (result.llmError) {
        llmErrorToast(result.llmError as LlmErrorBody, t, navigate);
      } else {
        toast.error(result.errorMessage ?? t(result.errorKey));
      }
    }
    return false;
  };

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;


  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t("invalidFormatError");
    }
    if (file.size > MAX_FILE_SIZE) {
      return t("fileTooLargeError");
    }
    return null;
  };

  const handleUploadClick = () => {
    setUploadModalOpen(true);
  };

  const handleProjectDropFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const primary = fileArray[0];
    const validationError = validateFile(primary);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setDroppedFile(primary);
    setUploadModalOpen(true);
  };

  /** Parse legacy stored screen_context (when user_data was embedded) for re-audit pre-fill. */
  const parseStoredScreenContext = (stored: string | null | undefined): { screenContext: string; userData: string } => {
    if (!stored || typeof stored !== "string") return { screenContext: "", userData: "" };
    const marker = "\n\nUser data:\n";
    const idx = stored.indexOf(marker);
    if (idx === -1) return { screenContext: stored.trim(), userData: "" };
    return {
      screenContext: stored.slice(0, idx).trim(),
      userData: stored.slice(idx + marker.length).trim(),
    };
  };

  const handleUploadWithPersonas = async (
    file: File,
    selectedPersonas: UploadPersona[],
    screenContext: string,
    contextImages?: ContextImageData[],
    userData?: string,
    synthPersonaIds?: string[],
    reauditUserNote?: string,
    provider?: import("@/services/llm-key.service").LLMProvider,
    model?: string
  ) => {
    if (!user || !id || !project) return;

    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setUploading(true);
    setUploadModalOpen(false);
    
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      await uploadScreenshot(filePath, file);

      const signedUrl = await createScreenshotSignedUrl(filePath, 3600);
      if (!signedUrl) {
        throw new Error("Failed to generate signed URL");
      }

      // Process context images - upload files and collect storage paths + signed URLs
      const contextImageUrls: string[] = [];
      const contextImagePaths: string[] = [];
      if (contextImages && contextImages.length > 0) {
        for (const ctxImg of contextImages) {
          if (ctxImg.source === "figma" && ctxImg.signedUrl) {
            // Figma images: store the storage path if available, otherwise the signed URL
            if (ctxImg.storagePath) {
              contextImagePaths.push(ctxImg.storagePath);
              contextImageUrls.push(ctxImg.signedUrl);
            } else {
              contextImageUrls.push(ctxImg.signedUrl);
            }
          } else if (ctxImg.source === "upload" && ctxImg.file) {
            // Upload the context file
            const ctxFileExt = ctxImg.file.name.split(".").pop();
            const ctxFileName = `${crypto.randomUUID()}.${ctxFileExt}`;
            const ctxFilePath = `${user.id}/${ctxFileName}`;

            await uploadScreenshot(ctxFilePath, ctxImg.file);
            contextImagePaths.push(ctxFilePath);
            const ctxSignedUrl = await createScreenshotSignedUrl(ctxFilePath, 3600);
            if (ctxSignedUrl) {
              contextImageUrls.push(ctxSignedUrl);
            }
          }
        }
      }

      // Store personas snapshot and screen context (array of personas)
      const personasSnapshot = selectedPersonas.map(p => ({
        name: p.name,
        description: p.description,
      }));

      const auditData = await createAudit.mutateAsync({
        project_id: id!,
        user_id: user.id,
        screenshot_url: filePath,
        selected_personas: personasSnapshot,
        screen_context: screenContext.trim() || null,
        user_data: userData?.trim() || null,
        context_images: contextImagePaths.length > 0 ? contextImagePaths : undefined,
        follow_up_audit_id: followUpAuditId ?? undefined,
        reaudit_type: followUpAuditId ? 'with_changes' : null,
        reaudit_user_note: reauditUserNote?.trim() || null,
        status: "pending",
      });

      toast.success(t("uploadSuccess"));

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyAuditQuota(user.id) });

      if (synthPersonaIds?.length) setIsSynthPending(true);
      // Retry closure: re-run just the analyze step after the user saves a key.
      const retryAnalyze = () => {
        void analyzeScreenshot(
          auditData.id,
          signedUrl,
          selectedPersonas,
          screenContext,
          contextImageUrls.length > 0 ? contextImageUrls : undefined,
          undefined,
          undefined,
          userData,
          synthPersonaIds,
          provider,
          model
        ).then((ok) => {
          if (ok) void queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
        });
      };
      const analysisSuccess = await analyzeScreenshot(
        auditData.id,
        signedUrl,
        selectedPersonas,
        screenContext,
        contextImageUrls.length > 0 ? contextImageUrls : undefined,
        undefined,
        undefined,
        userData,
        synthPersonaIds,
        provider,
        model,
        retryAnalyze
      );

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });

      if (analysisSuccess) {
        const { data: freshAudit } = await supabase
          .from("audits")
          .select("*")
          .eq("id", auditData.id)
          .single();

        if (freshAudit && freshAudit.ai_report) {
          const transformedAudit = transformAudit(freshAudit as Record<string, unknown>);
          setSelectedAuditSignedUrl(signedUrl);
          setSelectedAudit(transformedAudit);
        }
        setFollowUpAuditId(null);
      }
    } catch (error) {
      console.error("Upload error:", error);
      const err = error as Error & { name: string };
      if (err.message === 'STORAGE_LIMIT' || err.message === 'PERMISSION_DENIED') {
        toast.error(t("storageError"));
      } else if (err.name === 'TypeError' || err.message?.includes('network')) {
        toast.error(t("networkError"));
      } else {
        toast.error(t("genericUploadError"));
      }
    } finally {
      setUploading(false);
      setIsSynthPending(false);
    }
  };

  // Handle Figma import - image already uploaded to storage
  const handleFigmaUpload = async (
    imageUrl: string,
    storagePath: string,
    selectedPersonas: UploadPersona[],
    screenContext: string,
    contextImages?: ContextImageData[],
    figmaNodeSummary?: unknown,
    deepFigmaUiRequested?: boolean,
    userData?: string,
    synthPersonaIds?: string[],
    reauditUserNote?: string,
    provider?: import("@/services/llm-key.service").LLMProvider,
    model?: string
  ) => {
    if (!user || !id || !project) return;

    setUploading(true);
    setUploadModalOpen(false);
    
    try {
      // Process context images - upload files and collect signed URLs
      const contextImageUrls: string[] = [];
      if (contextImages && contextImages.length > 0) {
        for (const ctxImg of contextImages) {
          if (ctxImg.source === "figma" && ctxImg.signedUrl) {
            // Figma images already have signed URLs
            contextImageUrls.push(ctxImg.signedUrl);
          } else if (ctxImg.source === "upload" && ctxImg.file) {
            // Upload the context file
            const ctxFileExt = ctxImg.file.name.split(".").pop();
            const ctxFileName = `${crypto.randomUUID()}.${ctxFileExt}`;
            const ctxFilePath = `${user.id}/${ctxFileName}`;

            await uploadScreenshot(ctxFilePath, ctxImg.file);
            const ctxSignedUrl = await createScreenshotSignedUrl(ctxFilePath, 3600);
            if (ctxSignedUrl) {
              contextImageUrls.push(ctxSignedUrl);
            }
          }
        }
      }

      // Store personas snapshot and screen context
      const personasSnapshot = selectedPersonas.map(p => ({
        name: p.name,
        description: p.description,
      }));

      const auditData = await createAudit.mutateAsync({
        project_id: id!,
        user_id: user.id,
        screenshot_url: storagePath,
        selected_personas: personasSnapshot,
        screen_context: screenContext.trim() || null,
        user_data: userData?.trim() || null,
        follow_up_audit_id: followUpAuditId ?? undefined,
        reaudit_type: followUpAuditId ? 'with_changes' : null,
        reaudit_user_note: reauditUserNote?.trim() || null,
        status: "pending",
      });

      toast.success(t("uploadSuccess"));
      setLastFigmaAuditId(auditData.id);

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyAuditQuota(user.id) });

      if (synthPersonaIds?.length) setIsSynthPending(true);
      const retryFigmaAnalyze = () => {
        void analyzeScreenshot(
          auditData.id,
          imageUrl,
          selectedPersonas,
          screenContext,
          contextImageUrls.length > 0 ? contextImageUrls : undefined,
          figmaNodeSummary,
          deepFigmaUiRequested,
          userData,
          synthPersonaIds,
          provider,
          model
        ).then((ok) => {
          if (ok) void queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
        });
      };
      const analysisSuccess = await analyzeScreenshot(
        auditData.id,
        imageUrl, // Use the signed URL for analysis
        selectedPersonas,
        screenContext,
        contextImageUrls.length > 0 ? contextImageUrls : undefined,
        figmaNodeSummary,
        deepFigmaUiRequested,
        userData,
        synthPersonaIds,
        provider,
        model,
        retryFigmaAnalyze
      );

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });

      if (analysisSuccess) {
        const { data: freshAudit } = await supabase
          .from("audits")
          .select("*")
          .eq("id", auditData.id)
          .single();

        if (freshAudit && freshAudit.ai_report) {
          const transformedAudit = transformAudit(freshAudit as Record<string, unknown>);
          setSelectedAuditSignedUrl(imageUrl);
          setSelectedAudit(transformedAudit);
        }
        setFollowUpAuditId(null);
      }
    } catch (error) {
      console.error("Figma upload error:", error);
      toast.error(t("genericUploadError"));
    } finally {
      setUploading(false);
      setIsSynthPending(false);
    }
  };

  // Handle User Flow Upload (multi-screen analysis)
  const handleFlowUpload = async (
    files: File[],
    selectedPersonas: UploadPersona[],
    screenContext: string,
    userData?: string,
    synthPersonaIds?: string[],
    reauditUserNote?: string,
    provider?: import("@/services/llm-key.service").LLMProvider,
    model?: string
  ) => {
    if (!user || !id || !project) return;

    if (!session) {
      toast.error("Please log in to analyze flows");
      return;
    }

    setUploading(true);
    setUploadModalOpen(false);

    try {
      // Check if this is a Figma flow (URLs embedded in screenContext)
      let imageUrls: string[] = [];
      let storagePaths: string[] = [];
      let cleanScreenContext = screenContext;

      // Parse Figma data from screenContext (new format with storage paths)
      const FIGMA_DATA_MARKER = "[FIGMA_FLOW_DATA:";
      const FIGMA_URL_MARKER = "[FIGMA_FLOW_URLS:"; // Legacy support
      
      if (screenContext.startsWith(FIGMA_DATA_MARKER)) {
        // New format: includes both URLs and storage paths. Parse by counting braces
        // only outside double-quoted strings (URLs can contain "}" and break naive counting).
        const jsonStartIndex = FIGMA_DATA_MARKER.length;
        let braceCount = 0;
        let jsonEndIndex = -1;
        let insideString = false;
        let escapeNext = false;
        let stringChar = "";
        for (let i = jsonStartIndex; i < screenContext.length; i++) {
          const c = screenContext[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (insideString) {
            if (c === "\\") {
              escapeNext = true;
            } else if (c === stringChar) {
              insideString = false;
            }
            continue;
          }
          if (c === '"' || c === "'") {
            insideString = true;
            stringChar = c;
            continue;
          }
          if (c === "{") braceCount++;
          else if (c === "}") {
            braceCount--;
            if (braceCount === 0) {
              jsonEndIndex = i + 1;
              break;
            }
          }
        }
        
        if (jsonEndIndex > jsonStartIndex) {
          try {
            const jsonString = screenContext.slice(jsonStartIndex, jsonEndIndex);
            const data = JSON.parse(jsonString);
            imageUrls = data.urls || [];
            storagePaths = data.paths || [];
            // Remove the marker and any trailing bracket/newline
            cleanScreenContext = screenContext.slice(jsonEndIndex).replace(/^\]\n?/, "").trim();
          } catch (e) {
            console.error("Failed to parse Figma data:", e);
            toast.error("Failed to process Figma images");
            return;
          }
        } else {
          console.error("Could not find end of FIGMA_FLOW_DATA marker");
          toast.error("Failed to process Figma images");
          return;
        }
      } else if (screenContext.startsWith(FIGMA_URL_MARKER)) {
        // Legacy format: only URLs (fallback)
        const jsonStartIndex = FIGMA_URL_MARKER.length;
        let bracketCount = 0;
        let jsonEndIndex = -1;
        
        for (let i = jsonStartIndex; i < screenContext.length; i++) {
          if (screenContext[i] === "[") bracketCount++;
          if (screenContext[i] === "]") {
            if (bracketCount === 0) {
              jsonEndIndex = i;
              break;
            }
            bracketCount--;
          }
        }
        
        if (jsonEndIndex > jsonStartIndex) {
          try {
            const jsonString = screenContext.slice(jsonStartIndex, jsonEndIndex);
            imageUrls = JSON.parse(jsonString);
            cleanScreenContext = screenContext.slice(jsonEndIndex + 1).replace(/^\]\n?/, "").trim();
          } catch (e) {
            console.error("Failed to parse Figma URLs:", e);
            toast.error("Failed to process Figma images");
            return;
          }
        } else {
          console.error("Could not find end of FIGMA_FLOW_URLS marker");
          toast.error("Failed to process Figma images");
          return;
        }
      } else if (files.length > 0) {
        // Manual upload - need to upload files first
        for (const file of files) {
          const validationError = validateFile(file);
          if (validationError) {
            toast.error(validationError);
            return;
          }
        }

        // Upload all files
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileExt = file.name.split(".").pop();
          const fileName = `flow-step${i + 1}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          try {
            await uploadScreenshot(filePath, file);
          } catch (err) {
            console.error("Upload error:", err);
            toast.error(`Failed to upload image ${i + 1}`);
            return;
          }

          storagePaths.push(filePath);

          const signed = await createScreenshotSignedUrl(filePath, 3600);
          if (!signed) {
            toast.error("Failed to generate signed URL");
            return;
          }
          imageUrls.push(signed);
        }
      } else {
        toast.error("No images provided for flow analysis");
        return;
      }

      if (imageUrls.length < 2) {
        toast.error("Flow analysis requires at least 2 images");
        return;
      }

      // Build persona string for analysis
      const personaForAnalysis = selectedPersonas && selectedPersonas.length > 0
        ? selectedPersonas.map(p => `${p.name}: ${p.description}`).join("\n\n")
        : project.persona;

      // Store personas snapshot
      const personasSnapshot = selectedPersonas.map(p => ({
        name: p.name,
        description: p.description,
      }));

      // Create audit record with first image as thumbnail
      const primaryStoragePath = storagePaths.length > 0 
        ? storagePaths[0] 
        : imageUrls[0]; // For Figma, we use the URL directly for now

      const auditData = await createAudit.mutateAsync({
        project_id: id!,
        user_id: user.id,
        screenshot_url: primaryStoragePath,
        selected_personas: personasSnapshot,
        screen_context: cleanScreenContext.trim() || null,
        user_data: userData?.trim() || null,
        flow_images: storagePaths.length > 0 ? storagePaths : undefined,
        follow_up_audit_id: followUpAuditId ?? undefined,
        reaudit_type: followUpAuditId ? 'with_changes' : null,
        reaudit_user_note: reauditUserNote?.trim() || null,
        status: "pending",
      });

      toast.info(`Analyzing ${imageUrls.length}-step user flow...`);
      setAnalyzing(auditData.id);

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyAuditQuota(user.id) });

      const flowSynthIds = synthPersonaIds?.length ? synthPersonaIds : undefined;
      if (flowSynthIds?.length) setIsSynthPending(true);
      const flowTimeoutMs = flowSynthIds?.length ? 150_000 : 90_000;
      const flowController = new AbortController();
      const flowTimeoutId = setTimeout(() => flowController.abort(), flowTimeoutMs);

      let response: Response;
      try {
        // Call analyze-ui with images array + audit_id (optional synth in same invocation)
        response = await fetch(ANALYZE_UI_URL, {
          method: "POST",
          signal: flowController.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            audit_id: auditData.id,
            images: imageUrls,
            project_mission: project.scope === "section" && project.global_mission?.trim()
              ? `Product: ${project.global_mission.trim()}\n\nThis section: ${project.mission}`
              : project.mission,
            project_persona: personaForAnalysis,
            project_constraints: project.constraints,
            project_language: project.language || "English",
            screen_context: cleanScreenContext.trim() || null,
            user_data: userData?.trim() || undefined,
            project_additional_context: additionalContext || undefined,
            ...(flowSynthIds?.length ? { synth_persona_ids: flowSynthIds } : {}),
            ...(provider ? { provider } : {}),
            ...(model ? { model } : {}),
          }),
        });
      } finally {
        clearTimeout(flowTimeoutId);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          const llmErr = (errorData && typeof errorData === "object" && errorData.error)
            ? errorData as LlmErrorBody
            : { error: "rate_limit" } as LlmErrorBody;
          llmErrorToast(llmErr, t, navigate);
          setUploading(false);
          setAnalyzing(null);
          setIsSynthPending(false);
          return;
        }
        if (response.status === 402 && errorData.error === "no_key") {
          // Capture retry so after the user saves a key we re-fire the fetch
          const capturedImageUrls = imageUrls;
          const capturedAuditId = auditData.id;
          setPendingRetry(() => () => {
            void (async () => {
              if (!session) return;
              const retryController = new AbortController();
              const retryTimeoutId = setTimeout(() => retryController.abort(), flowTimeoutMs);
              try {
                const retryResp = await fetch(ANALYZE_UI_URL, {
                  method: "POST",
                  signal: retryController.signal,
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                  body: JSON.stringify({
                    audit_id: capturedAuditId,
                    images: capturedImageUrls,
                    project_mission: project.scope === "section" && project.global_mission?.trim()
                      ? `Product: ${project.global_mission.trim()}\n\nThis section: ${project.mission}`
                      : project.mission,
                    project_persona: personaForAnalysis,
                    project_constraints: project.constraints,
                    project_language: project.language || "English",
                    screen_context: cleanScreenContext.trim() || null,
                    user_data: userData?.trim() || undefined,
                    project_additional_context: additionalContext || undefined,
                    ...(flowSynthIds?.length ? { synth_persona_ids: flowSynthIds } : {}),
                    ...(provider ? { provider } : {}),
                    ...(model ? { model } : {}),
                  }),
                });
                clearTimeout(retryTimeoutId);
                if (retryResp.ok) {
                  await retryResp.json();
                  toast.success("Flow analysis complete!");
                  void queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
                }
              } catch { /* ignore retry errors */ } finally {
                clearTimeout(retryTimeoutId);
              }
            })();
          });
          setTrialExhaustedOpen(true);
          setUploading(false);
          setAnalyzing(null);
          setIsSynthPending(false);
          return;
        }
        // Other typed LLM errors (invalid_key, billing_block, provider_error, bad_request)
        if (errorData && typeof errorData === "object" && errorData.error) {
          llmErrorToast(errorData as LlmErrorBody, t, navigate);
          setUploading(false);
          setAnalyzing(null);
          setIsSynthPending(false);
          return;
        }
        throw new Error(errorData.error || "Flow analysis failed");
      }

      // Edge function handles DB update, just consume response
      await response.json();

      toast.success("Flow analysis complete!");

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });

      // Select the new audit
      const { data: freshAudit } = await supabase
        .from("audits")
        .select("*")
        .eq("id", auditData.id)
        .single();

      if (freshAudit && freshAudit.ai_report) {
        const transformedAudit = transformAudit(freshAudit as Record<string, unknown>);
        const signedUrl = storagePaths.length > 0
          ? (await createScreenshotSignedUrl(storagePaths[0], 3600)) || imageUrls[0]
          : imageUrls[0];
        setSelectedAuditSignedUrl(signedUrl);
        setSelectedAudit(transformedAudit);
      }
      setFollowUpAuditId(null);
    } catch (error) {
      console.error("Flow analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze flow");
    } finally {
      setUploading(false);
      setAnalyzing(null);
      setIsSynthPending(false);
    }
  };

  const handleAutoAudit = async (payload: AutoCrawlPayload) => {
    if (!user || !id || !project || !session) return;

    setUploading(true);

    try {
      const response = await fetch(CRAWL_REQUEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: id,
          crawl_url: payload.url,
          ...(payload.provider ? { provider: payload.provider } : {}),
          ...(payload.model ? { model: payload.model } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start auto-audit");
      }

      const data = await response.json();

      // Single action: GH Actions already triggered, close modal.
      setUploadModalOpen(false);
      toast.success(t("autoAuditCrawling"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
      if (user) void queryClient.invalidateQueries({ queryKey: queryKeys.dailyAuditQuota(user.id) });
    } catch (error) {
      console.error("Auto-audit error:", error);
      const msg = error instanceof Error ? error.message : "Failed to start auto-audit";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handlePrototypeCrawl = async (payload: PrototypeCrawlPayload) => {
    if (!user || !id || !project || !session) return;

    setUploading(true);

    try {
      const selectedPersonas = personas.filter(p => payload.selectedPersonaIds.includes(p.id));
      const personasSnapshot = selectedPersonas.map(p => ({ id: p.id, name: p.name, description: p.description }));
      const personaText = personasSnapshot.length > 0
        ? personasSnapshot.map(p => `${p.name}: ${p.description}`).join("\n\n")
        : "";

      const response = await fetch(FIGMA_PROTOTYPE_CRAWL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: id,
          figma_url: payload.figmaUrl,
          persona_text: personaText,
          user_data: payload.userData,
          selected_personas: personasSnapshot,
          ...(followUpAuditId ? { follow_up_audit_id: followUpAuditId, reauditType: 'with_changes' } : {}),
          ...(payload.reauditUserNote ? { reauditUserNote: payload.reauditUserNote } : {}),
          ...(payload.provider ? { provider: payload.provider } : {}),
          ...(payload.model ? { model: payload.model } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Failed to start prototype audit");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setUploadModalOpen(false);
      toast.success(t("prototypeCrawlCrawling"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
      if (user) void queryClient.invalidateQueries({ queryKey: queryKeys.dailyAuditQuota(user.id) });
    } catch (error) {
      console.error("Prototype crawl error:", error);
      const msg = error instanceof Error ? error.message : "Failed to start prototype audit";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleReauditWithFeedbackOnly = async (audit: Audit) => {
    if (!user || !id || !project || !session) return;
    setReauditChoiceOpen(false);
    setAuditForReaudit(null);
    setUploading(true);

    const personasSnapshot = audit.selected_personas ?? [];
    const personaForAnalysis =
      personasSnapshot.length > 0
        ? personasSnapshot.map((p) => `${p.name}: ${p.description}`).join("\n\n")
        : project.persona;

    try {
      const auditData = await createAudit.mutateAsync({
        project_id: id!,
        user_id: user.id,
        screenshot_url: audit.screenshot_url,
        selected_personas: personasSnapshot,
        screen_context: audit.screen_context?.trim() || null,
        user_data: audit.user_data?.trim() || null,
        flow_images: audit.flow_images ?? undefined,
        follow_up_audit_id: audit.id,
        reaudit_type: 'feedback_only',
        status: "pending",
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyAuditQuota(user.id) });

      const reauditSynthIds =
        audit.ai_report?.synth_users?.results
          ?.map((r) => r.persona_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(0, 3) ?? [];
      const hasReauditSynth = reauditSynthIds.length > 0;

      const isPrototypeReaudit =
        audit.ai_report?.analysis_mode === "prototype" || audit.source === "prototype-crawl";

      const isFlow =
        audit.flow_images &&
        Array.isArray(audit.flow_images) &&
        audit.flow_images.length > 1;

      if (isFlow && audit.flow_images?.length) {
        setAnalyzing(auditData.id);
        toast.info(
          isPrototypeReaudit
            ? t("reauditingPrototypeWithFeedback")
            : `Re-auditing ${audit.flow_images.length}-step flow with your feedback...`
        );
        const rawUrls = await createScreenshotSignedUrls(audit.flow_images, 3600);
        const imageUrls = rawUrls.filter((u) => u && !u.includes("placeholder"));
        if (imageUrls.length === 0) {
          toast.error("Screenshots unavailable — cannot re-audit. The flow images may be missing or inaccessible.");
          setAnalyzing(null);
          setUploading(false);
          return;
        }
        if (hasReauditSynth) setIsSynthPending(true);
        const flowReauditTimeoutMs = hasReauditSynth ? 150_000 : 90_000;
        const flowReauditController = new AbortController();
        const flowReauditTimeoutId = setTimeout(() => flowReauditController.abort(), flowReauditTimeoutMs);
        let response: Response;
        try {
          response = await fetch(ANALYZE_UI_URL, {
            method: "POST",
            signal: flowReauditController.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              audit_id: auditData.id,
              images: imageUrls,
              project_mission:
                project.scope === "section" && project.global_mission?.trim()
                  ? `Product: ${project.global_mission.trim()}\n\nThis section: ${project.mission}`
                  : project.mission,
              project_persona: personaForAnalysis,
              project_constraints: project.constraints,
              project_language: project.language || "English",
              screen_context: audit.screen_context?.trim() || null,
              user_data: audit.user_data?.trim() || undefined,
              project_additional_context: additionalContext || undefined,
              ...(hasReauditSynth ? { synth_persona_ids: reauditSynthIds } : {}),
            }),
          });
        } finally {
          clearTimeout(flowReauditTimeoutId);
        }
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData && typeof errorData === "object" && errorData.error) {
            llmErrorToast(errorData as LlmErrorBody, t, navigate);
            return;
          }
          if (response.status === 429) {
            llmErrorToast({ error: "rate_limit" }, t, navigate);
            return;
          }
          throw new Error(errorData.error || "Re-audit failed");
        }
        await response.json();
        toast.success("Re-audit complete!");
      } else {
        toast.info("Re-auditing with your feedback...");
        const pathOrUrl = audit.screenshot_url;
        let signedUrl: string | null = null;
        if (pathOrUrl?.startsWith("http")) {
          signedUrl = pathOrUrl;
        } else if (pathOrUrl) {
          signedUrl = await createScreenshotSignedUrl(pathOrUrl, 3600);
        }
        if (!signedUrl) {
          toast.error("Screenshot unavailable — cannot re-audit. The image may be missing or inaccessible.");
          setUploading(false);
          return;
        }
        const uploadPersonas: UploadPersona[] = personasSnapshot.map((p) => ({
          id: p.name,
          name: p.name,
          description: p.description,
        }));
        if (hasReauditSynth) setIsSynthPending(true);
        const analyzeResult = await analyzeScreenshotFn(
          auditData.id,
          signedUrl,
          uploadPersonas,
          audit.screen_context ?? undefined,
          undefined,
          additionalContext || undefined,
          undefined,
          undefined,
          audit.user_data ?? undefined,
          hasReauditSynth ? reauditSynthIds : undefined
        );
        if (!analyzeResult.success) {
          if (analyzeResult.errorKey) {
            if (analyzeResult.llmError) {
              llmErrorToast(analyzeResult.llmError as LlmErrorBody, t, navigate);
            } else {
              toast.error(analyzeResult.errorMessage ?? t(analyzeResult.errorKey));
            }
          }
          return;
        }
        toast.success("Re-audit complete!");
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });

      const { data: freshAudit } = await supabase
        .from("audits")
        .select("*")
        .eq("id", auditData.id)
        .single();

      if (freshAudit?.ai_report) {
        // Inherit synth_users from original audit when we did not re-run synth in this request
        const originalSynth = audit.ai_report?.synth_users;
        if (originalSynth && !hasReauditSynth) {
          const mergedReport = {
            ...(freshAudit.ai_report as Record<string, unknown>),
            synth_users: originalSynth,
            synth_inherited: true,
          };
          await updateAuditReport(auditData.id, mergedReport);
          freshAudit.ai_report = mergedReport;
        }

        const transformedAudit = transformAudit(freshAudit as Record<string, unknown>);
        const displayUrl =
          isFlow && audit.flow_images?.length
            ? (await createScreenshotSignedUrl(audit.flow_images[0], 3600)) ?? null
            : await createScreenshotSignedUrl(audit.screenshot_url, 3600);
        setSelectedAuditSignedUrl(displayUrl);
        setSelectedAudit(transformedAudit);
      }
    } catch (error) {
      console.error("Re-audit error:", error);
      toast.error(error instanceof Error ? error.message : "Re-audit failed");
    } finally {
      setUploading(false);
      setAnalyzing(null);
      setIsSynthPending(false);
    }
  };

  const handleDeleteAuditClick = (e: React.MouseEvent, audit: Audit) => {
    e.stopPropagation();
    setAuditToDelete(audit);
    setDeleteDialogOpen(true);
  };

  const handleDeleteAuditConfirm = async () => {
    if (!auditToDelete) return;
    try {
      await deleteAuditMutation.mutateAsync(auditToDelete);
      toast.success(t("auditDeletedSuccess"));
      setDeleteDialogOpen(false);
      setAuditToDelete(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("errorGeneric"));
    }
  };

  const handleTransferConfirm = async () => {
    if (!project) return;
    const orgId = transferDirection === "to-team" ? (org?.id ?? null) : null;
    try {
      await transferProjectMutation.mutateAsync({ projectId: project.id, orgId });
      toast.success(
        transferDirection === "to-team"
          ? t("projectTransferredToTeam").replace("{{teamName}}", org?.name ?? "")
          : t("projectMadePrivate")
      );
      setTransferDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    }
  };

  const handleDeleteProjectConfirm = async () => {
    if (!project) return;
    try {
      await deleteProjectMutation.mutateAsync(project);
      toast.success(t("projectDeletedSuccess"));
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Happy path bridge */}
      <TourBridge
        bridgeName="after_project_view"
        targetSelector='[data-tour="new-audit-button"]'
        label="Upload a screenshot to run your first audit"
        position="bottom"
      />

      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none" />

      <ProjectPageHeader
        projectName={project.name}
        onBack={() => navigate("/dashboard")}
        backLabel={t("back")}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: breadcrumb + visibility pill */}
          <div className="flex items-center gap-2 min-w-0">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">{t("dashboard")}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{project.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {project.org_id ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Users className="h-3 w-3" />
                {org?.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted/50 text-muted-foreground border border-border shrink-0">
                <Lock className="h-3 w-3" />
                {t("togglePersonal")}
              </span>
            )}
            {project.org_id && (
              <>
                <div className="w-px h-3 bg-border mx-1" />
                <OwnerBadge userId={project.user_id} size="sm" />
              </>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!project.org_id ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 text-primary/80 border-primary/20 hover:bg-primary/10 hover:text-primary"
                disabled={!org}
                title={!org ? t("noTeamMoveDisabled") : undefined}
                onClick={() => {
                  setTransferDirection("to-team");
                  setTransferDialogOpen(true);
                }}
              >
                <ArrowLeftRight className="h-3 w-3" />
                {t("moveToTeam")}
              </Button>
            ) : canManageProject(user?.id, project.user_id, org?.owner_id) ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 text-amber-500/80 border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-500"
                onClick={() => {
                  setTransferDirection("to-personal");
                  setTransferDialogOpen(true);
                }}
              >
                <Lock className="h-3 w-3" />
                {t("makePrivate")}
              </Button>
            ) : null}
            {canManageProject(
              user?.id,
              project.user_id,
              project.org_id ? org?.owner_id : undefined
            ) && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 text-red-400/70 border-destructive/20 hover:bg-destructive/10 hover:text-red-400"
                onClick={() => setDeleteProjectDialogOpen(true)}
              >
                <Trash2 className="h-3 w-3" />
                {t("deleteProject")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Audits Area — show first on mobile */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1 lg:order-2">
            <ProjectUploadZone
              uploading={uploading}
              onClick={handleUploadClick}
              uploadLabel={t("uploadScreenshots")}
              uploadingLabel={t("analyzingUpload")}
              idleHint={t("dragAndDropHint")}
              uploadingHint={t("analyzingUploadHint")}
              dataTour="new-audit-button"
              onDropFiles={handleProjectDropFiles}
            />

            {auditsIsError ? (
              <ErrorState
                message={auditsError instanceof Error ? auditsError.message : "Couldn't load audits"}
                onRetry={() => void refetchAudits()}
              />
            ) : (
              <ProjectAuditsList
                audits={auditsData}
                sortedAudits={sortedAudits}
                sortBy={sortBy}
                onSortChange={setSortBy}
                getSignedUrl={getSignedUrl}
                analyzingAuditId={analyzing}
                onSelectAudit={async (audit) => {
                  setSelectedAudit(audit);
                  // Always fetch a fresh signed URL when opening so we never show an expired or stale URL
                  const pathOrUrl = audit.screenshot_url;
                  if (!pathOrUrl) {
                    setSelectedAuditSignedUrl("/placeholder.svg");
                    return;
                  }
                  if (pathOrUrl.startsWith("http")) {
                    setSelectedAuditSignedUrl(pathOrUrl);
                    return;
                  }
                  const signed = await createScreenshotSignedUrl(pathOrUrl, 3600);
                  setSelectedAuditSignedUrl(signed ?? "/placeholder.svg");
                }}
                onDeleteAudit={handleDeleteAuditClick}
                onRetryAudit={(audit) => async (e: React.MouseEvent) => {
                  e.stopPropagation();

                  // Prototype-crawl audits need a fresh crawl submission, not analyzeScreenshot
                  if (audit.source === "prototype-crawl" && audit.screen_context && session) {
                    const personasSnapshot = audit.selected_personas ?? [];
                    const personaText = personasSnapshot.map(p => `${p.name}: ${p.description}`).join("\n\n");
                    try {
                      const resp = await fetch(FIGMA_PROTOTYPE_CRAWL_URL, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                          project_id: id,
                          figma_url: audit.screen_context,
                          persona_text: personaText,
                          user_data: audit.user_data ?? "",
                          selected_personas: personasSnapshot,
                        }),
                      });
                      if (resp.ok) {
                        toast.success(t("prototypeCrawlCrawling"));
                        await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
                      } else {
                        const err = await resp.json().catch(() => ({}));
                        toast.error(err.error || "Failed to retry prototype audit");
                      }
                    } catch {
                      toast.error("Failed to retry prototype audit");
                    }
                    return;
                  }

                  const signedUrl = getSignedUrl(audit.screenshot_url);
                  if (signedUrl === "/placeholder.svg") {
                    const dataSignedUrl = await createScreenshotSignedUrl(audit.screenshot_url, 3600);
                    if (dataSignedUrl) {
                      await analyzeScreenshot(
                        audit.id,
                        dataSignedUrl,
                        audit.selected_personas?.map((p) => ({ ...p, id: p.name })) ?? undefined,
                        audit.screen_context ?? undefined
                      );
                      await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
                    }
                  } else {
                    await analyzeScreenshot(
                      audit.id,
                      signedUrl,
                      audit.selected_personas?.map((p) => ({ ...p, id: p.name })) ?? undefined,
                      audit.screen_context ?? undefined
                    );
                    await queryClient.invalidateQueries({ queryKey: queryKeys.audits(id) });
                  }
                }}
                allAudits={auditsData}
                t={t}
              />
            )}
          </div>

          {/* Project Context Sidebar — below audits on mobile, left column on desktop */}
          <div className="lg:col-span-1 order-2 lg:order-1" data-tour="project-context-card">
            <ProjectContextCard
              project={{ ...project, scope: project.scope as "whole" | "section" }}
              personas={personas}
              onEdit={() => setEditDialogOpen(true)}
            />
          </div>
        </div>
      </main>

      {/* Audit Detail Modal */}
      {selectedAudit && project && selectedAudit.ai_report && selectedAuditSignedUrl && (
        <AuditDetail
          audit={{
            ...selectedAudit,
            screenshot_url: selectedAuditSignedUrl,
            /** Storage path for same-screen detection (feedback-only vs reaudit-with-changes); display uses screenshot_url which may be signed */
            screenshot_storage_path: selectedAudit.screenshot_url,
            flow_images: selectedAudit.flow_images,
            context_images: selectedAudit.context_images,
          }}
          aiReport={selectedAudit.ai_report}
          projectContext={{
            name: project.name,
            mission: project.mission,
            persona: selectedAudit.selected_personas && selectedAudit.selected_personas.length > 0
              ? selectedAudit.selected_personas.map(p => `${p.name}: ${p.description}`).join("\n\n")
              : project.persona,
            constraints: project.constraints,
            language: project.language,
          }}
          personas={personas}
          projectId={project.id}
          onClose={() => {
            setSelectedAudit(null);
            setSelectedAuditSignedUrl(null);
          }}
          userId={user?.id}
          onReAuditRequest={() => {
            if (!selectedAudit) return;
            setAuditForReaudit(selectedAudit);
            setSelectedAudit(null);
            setSelectedAuditSignedUrl(null);
            setReauditChoiceOpen(true);
          }}
          onOpenAuditId={async (auditId) => {
            const audit = auditsData.find((a) => a.id === auditId);
            if (!audit) return;
            setSelectedAudit(audit);
            const pathOrUrl = audit.screenshot_url;
            if (!pathOrUrl) {
              setSelectedAuditSignedUrl("/placeholder.svg");
              return;
            }
            if (pathOrUrl.startsWith("http")) {
              setSelectedAuditSignedUrl(pathOrUrl);
              return;
            }
            const signed = await createScreenshotSignedUrl(pathOrUrl, 3600);
            setSelectedAuditSignedUrl(signed ?? "/placeholder.svg");
          }}
          previousAudit={
            selectedAudit.follow_up_audit_id
              ? (auditsData.find(a => a.id === selectedAudit.follow_up_audit_id) ?? null)
              : null
          }
          latestReaudit={(() => {
            if (selectedAudit.follow_up_audit_id) return null;
            const reaudits = auditsData.filter(a => a.follow_up_audit_id === selectedAudit.id);
            if (!reaudits.length) return null;
            return reaudits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          })()}
          isSynthPending={isSynthPending}
          onRunSynth={async (personaIds) => {
            if (!selectedAudit || !id) return;
            const result = await runSynth({
              auditId: selectedAudit.id,
              projectId: id,
              personaIds,
              projectLanguage: project?.language,
              screenContext: selectedAudit.screen_context,
            });
            if (!result.ok) {
              const errorKey = result.errorKey ?? "addSynthFailedToast";
              toast.error(t(errorKey));
            }
          }}
          showPluginCTA={!!lastFigmaAuditId && selectedAudit?.id === lastFigmaAuditId}
        />
      )}

      <DeleteAuditDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteAuditConfirm}
        deleting={deleteAuditMutation.isPending}
        title={t("deleteAudit")}
        description={`${t("deleteAuditConfirm")} ${t("deleteAuditWarning")}`}
        cancelLabel={t("cancel")}
        deleteLabel={t("delete")}
        deletingLabel={t("deleting")}
      />

      {/* Edit Project Dialog */}
      {project && (
        <EditProjectDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          project={project as Project}
          onSave={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.project(id) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.personas(id) });
          }}
        />
      )}

      {/* Re-audit choice modal */}
      <Dialog open={reauditChoiceOpen} onOpenChange={(open) => {
        if (!open) {
          setReauditChoiceOpen(false);
          setAuditForReaudit(null);
        }
      }}>
        <DialogContent className="sm:max-w-md glass border-border max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base">{t("reauditChoiceTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-1 flex-col min-h-0 pt-2">
            <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
              <Button
                variant="outline"
                className="w-full justify-start h-auto min-h-12 py-3 px-3 flex items-start gap-2 text-left normal-case"
                onClick={() => auditForReaudit && handleReauditWithFeedbackOnly(auditForReaudit)}
                disabled={uploading || !auditForReaudit}
              >
                <RefreshCw className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-medium text-sm break-words whitespace-normal">
                    {t("reauditWithFeedbackOnly")}
                  </p>
                  <p className="text-xs text-muted-foreground font-normal break-words whitespace-normal leading-snug mt-0.5">
                    {t("reauditWithFeedbackOnlyDesc")}
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto min-h-12 py-3 px-3 flex items-start gap-2 text-left normal-case"
                onClick={() => {
                  if (!auditForReaudit) return;
                  const isPrototype =
                    auditForReaudit.ai_report?.analysis_mode === "prototype" ||
                    auditForReaudit.source === "prototype-crawl";
                  const isFlow =
                    !isPrototype &&
                    auditForReaudit.flow_images &&
                    Array.isArray(auditForReaudit.flow_images) &&
                    auditForReaudit.flow_images.length > 1;
                  const parsed = parseStoredScreenContext(auditForReaudit.screen_context ?? "");
                  const screenContext =
                    auditForReaudit.user_data != null
                      ? (auditForReaudit.screen_context ?? "").trim()
                      : parsed.screenContext;
                  const userData = (auditForReaudit.user_data ?? parsed.userData)?.trim() ?? "";
                  const synthIds = auditForReaudit.ai_report?.synth_users?.results?.map((r) => r.persona_id) ?? [];
                  setReAuditContext({
                    type: isPrototype ? "prototype" : isFlow ? "flow" : "single",
                    screenContext,
                    ...(userData ? { userData } : {}),
                    ...(synthIds.length > 0 ? { synthPersonaIds: synthIds } : {}),
                  });
                  setFollowUpAuditId(auditForReaudit.id);
                  setReauditChoiceOpen(false);
                  setAuditForReaudit(null);
                  setUploadModalOpen(true);
                }}
                disabled={!auditForReaudit}
              >
                <Upload className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="font-medium text-sm break-words whitespace-normal">
                    {t("reauditAfterChangesToMockup")}
                  </p>
                  <p className="text-xs text-muted-foreground font-normal break-words whitespace-normal leading-snug mt-0.5">
                    {t("reauditAfterChangesDesc")}
                  </p>
                </div>
              </Button>
            </div>
            <div className="flex justify-end pt-3 flex-shrink-0 border-t border-border/50 mt-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setReauditChoiceOpen(false);
                  setAuditForReaudit(null);
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={(open) => {
          setUploadModalOpen(open);
          if (!open) {
            setReAuditContext(null);
            setFollowUpAuditId(null);
          }
        }}
        personas={personas}
        onUpload={handleUploadWithPersonas}
        onFigmaUpload={handleFigmaUpload}
        onFlowUpload={handleFlowUpload}
        onAutoAudit={handleAutoAudit}
        onPrototypeCrawl={handlePrototypeCrawl}
        uploading={uploading}
        userId={user?.id}
        initialFile={droppedFile}
        onInitialFileClear={() => setDroppedFile(null)}
        initialStep={reAuditContext?.type}
        initialScreenContext={reAuditContext?.screenContext ?? undefined}
        initialUserData={reAuditContext?.userData}
        isReauditFlow={!!reAuditContext}
        initialSynthPersonaIds={reAuditContext?.synthPersonaIds}
      />

      {/* Transfer project dialog */}
      {project && org && (
        <TransferProjectDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          project={project}
          direction={transferDirection}
          org={org}
          onConfirm={handleTransferConfirm}
          isPending={transferProjectMutation.isPending}
        />
      )}

      {/* Trial-exhausted / BYOK modal */}
      <TrialExhaustedDialog
        open={trialExhaustedOpen}
        onOpenChange={setTrialExhaustedOpen}
        onSavedKey={() => {
          pendingRetry?.();
          setPendingRetry(null);
        }}
      />

      {/* Delete project dialog */}
      <AlertDialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <AlertDialogContent className="glass border-border max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteProject")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteProjectConfirm")} "{project?.name}"? {t("deleteProjectWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProjectMutation.isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProjectConfirm}
              disabled={deleteProjectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProjectMutation.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Project;
