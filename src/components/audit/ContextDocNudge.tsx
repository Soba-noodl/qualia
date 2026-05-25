import { X, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTourState } from "@/contexts/TourStateContext";
import { useContextDocuments } from "@/hooks/use-context-documents";
import { useInitiateOAuth } from "@/hooks/use-integrations";
import { useLanguage } from "@/contexts/LanguageContext";

interface ContextDocNudgeProps {
  projectId: string;
}

const ContextDocNudge = ({ projectId }: ContextDocNudgeProps) => {
  const { t } = useLanguage();
  const { shouldShowTour, markTourCompleted } = useTourState();
  const { data: contextDocs } = useContextDocuments(projectId);
  const initiateOAuth = useInitiateOAuth();

  const hasContextDocs = (contextDocs?.length ?? 0) > 0;
  const userDataNudgeDismissed = !shouldShowTour("userDataNudge");

  if (hasContextDocs || !shouldShowTour("contextDocNudge") || !userDataNudgeDismissed) return null;

  const returnTo = `/project/${projectId}`;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <Link2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium mb-1">
          {t("contextDocNudgeHeadline")}
        </p>
        <p className="text-sm text-muted-foreground mb-2">
          {t("contextDocNudgeBody")}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => initiateOAuth.mutate({ provider: "notion", returnTo })}
            disabled={initiateOAuth.isPending}
          >
            {t("contextDocNudgeConnectNotion")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => initiateOAuth.mutate({ provider: "drive", returnTo })}
            disabled={initiateOAuth.isPending}
          >
            {t("contextDocNudgeConnectDrive")}
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground -mt-0.5 -mr-0.5"
        onClick={() => markTourCompleted("contextDocNudge")}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default ContextDocNudge;
