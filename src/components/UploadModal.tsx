import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import AuditTypeSelector, { AuditType } from "./audit/AuditTypeSelector";
import SingleScreenForm, { ContextImageData } from "./audit/SingleScreenForm";
import FlowAnalysisForm from "./audit/FlowAnalysisForm";
import AutoCrawlForm, { AutoCrawlPayload } from "./audit/AutoCrawlForm";
import PrototypeCrawlForm, { PrototypeCrawlPayload } from "./audit/PrototypeCrawlForm";
import { useAuditCreationTour } from "@/hooks/use-product-tour";
import { toast } from "@/components/ui/sonner";

// Re-exported for backward compatibility — canonical definition lives in @/types/audit.ts
export type { UploadPersona } from "@/types/audit";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personas: UploadPersona[];
  onUpload: (file: File, selectedPersonas: UploadPersona[], screenContext: string, contextImages?: ContextImageData[], userData?: string, synthPersonaIds?: string[], reauditUserNote?: string, provider?: import("@/services/llm-key.service").LLMProvider) => void;
  onFigmaUpload?: (imageUrl: string, storagePath: string, selectedPersonas: UploadPersona[], screenContext: string, contextImages?: ContextImageData[], figmaNodeSummary?: unknown, deepFigmaUiRequested?: boolean, userData?: string, synthPersonaIds?: string[], reauditUserNote?: string, provider?: import("@/services/llm-key.service").LLMProvider) => void;
  onFlowUpload?: (files: File[], selectedPersonas: UploadPersona[], screenContext: string, userData?: string, synthPersonaIds?: string[], reauditUserNote?: string, provider?: import("@/services/llm-key.service").LLMProvider, model?: string) => void;
  onAutoAudit?: (payload: AutoCrawlPayload) => void;
  onPrototypeCrawl?: (payload: PrototypeCrawlPayload) => void;
  uploading: boolean;
  userId?: string;
  initialFile?: File | null;
  onInitialFileClear?: () => void;
  /** When set (e.g. re-audit), open directly on this step instead of type selection */
  initialStep?: "single" | "flow" | "prototype";
  /** Pre-fill screen goal / flow goal (e.g. from the audit we're re-auditing from) */
  initialScreenContext?: string;
  /** Pre-fill user data field (e.g. from the audit we're re-auditing from), only if it was set before */
  initialUserData?: string;
  /** When true, show "Re-audit" as title instead of audit type (single/flow) */
  isReauditFlow?: boolean;
  /** Pre-select synth personas (e.g. when re-auditing an audit that had synth analysis) */
  initialSynthPersonaIds?: string[];
}

type ModalStep = "select" | "single" | "flow" | "auto" | "prototype";

const UploadModal = ({
  open,
  onOpenChange,
  personas,
  onUpload,
  onFigmaUpload,
  onFlowUpload,
  onAutoAudit,
  onPrototypeCrawl,
  uploading,
  userId,
  initialFile,
  onInitialFileClear,
  initialStep,
  initialScreenContext,
  initialUserData,
  isReauditFlow,
  initialSynthPersonaIds,
}: UploadModalProps) => {
  const { t } = useLanguage();
  const { startTour, destroyTour } = useAuditCreationTour();
  const [step, setStep] = useState<ModalStep>("select");

  // Reset step when modal closes
  useEffect(() => {
    if (!open) {
      setStep("select");
      destroyTour();
    }
  }, [open, destroyTour]);

  // When opening for re-audit, go directly to single or flow step
  useEffect(() => {
    if (open && initialStep) {
      setStep(initialStep);
    }
  }, [open, initialStep]);

  // Start tour immediately when modal opens on the selection step
  useEffect(() => {
    if (open && step === "select") {
      startTour();
    }
  }, [open, step, startTour]);

  const handleSelectAuditType = (type: AuditType) => {
    setStep(type);
  };

  const handleBack = () => {
    setStep("select");
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("select");
    }
    onOpenChange(isOpen);
  };

  const handleFlowUpload = (files: File[], selectedPersonas: UploadPersona[], screenContext: string, userData?: string, synthPersonaIds?: string[], reauditUserNote?: string, provider?: import("@/services/llm-key.service").LLMProvider, model?: string) => {
    if (onFlowUpload) {
      onFlowUpload(files, selectedPersonas, screenContext, userData, synthPersonaIds, reauditUserNote, provider, model);
    }
  };

  const getDialogTitle = () => {
    if (isReauditFlow && (step === "single" || step === "flow")) {
      return t("reAuditTitle");
    }
    switch (step) {
      case "select":
        return t("uploadScreenshots");
      case "single":
        return t("singleScreenAudit");
      case "flow":
        return t("userFlowAnalysis");
      case "auto":
        return t("autoAudit");
      case "prototype":
        return t("prototypeCrawl");
      default:
        return t("uploadScreenshots");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg glass border-border max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {step === "select" && (
            <div className="flex-1 min-h-0 overflow-y-auto py-4">
              <AuditTypeSelector
                onSelect={handleSelectAuditType}
                auditsRemaining={Infinity}
                isUnlimited={true}
              />
            </div>
          )}

          {step === "single" && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <SingleScreenForm
                personas={personas}
                onUpload={onUpload}
                onFigmaUpload={onFigmaUpload}
                onBack={handleBack}
                uploading={uploading}
                initialFile={initialFile}
                onInitialFileClear={onInitialFileClear}
                initialScreenContext={initialScreenContext}
                initialUserData={initialUserData}
                initialSynthPersonaIds={initialSynthPersonaIds}
                isReauditFlow={isReauditFlow}
              />
            </div>
          )}

          {step === "flow" && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <FlowAnalysisForm
                personas={personas}
                onFlowUpload={handleFlowUpload}
                onBack={handleBack}
                uploading={uploading}
                initialScreenContext={initialScreenContext}
                initialUserData={initialUserData}
                initialSynthPersonaIds={initialSynthPersonaIds}
                isReauditFlow={isReauditFlow}
              />
            </div>
          )}

          {step === "auto" && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <AutoCrawlForm
                onSubmit={(payload) => {
                  if (onAutoAudit) onAutoAudit(payload);
                }}
                onBack={handleBack}
                submitting={uploading}
              />
            </div>
          )}

          {step === "prototype" && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <PrototypeCrawlForm
                personas={personas}
                onSubmit={(payload) => {
                  if (onPrototypeCrawl) onPrototypeCrawl(payload);
                }}
                onBack={handleBack}
                submitting={uploading}
                isReauditFlow={isReauditFlow}
              />
            </div>
          )}
        </div>

        {/* Cancel button only shown on selection step */}
        {step === "select" && (
          <div className="flex justify-end pt-4 border-t border-border flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
