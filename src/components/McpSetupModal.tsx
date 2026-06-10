import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { MCP_URL } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

interface McpSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export function McpSetupModal({ open, onOpenChange, onDone }: McpSetupModalProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const copyUrl = () => {
    void navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCmd = () => {
    void navigator.clipboard.writeText(`claude mcp add --transport http qualia ${MCP_URL}`);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleDone = () => {
    if (onDone) {
      void navigator.clipboard.writeText(
        "Analyze my Qualia audit and generate visual fixes for the top 3 critical issues."
      );
      toast.success(t("mcpSetupPromptCopied"));
      onDone();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("mcpSetupTitle")}</DialogTitle>
          <DialogDescription>{t("mcpSetupDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 min-w-0">
          {/* Step 1: Copy URL */}
          <div className="flex gap-3 items-start">
            <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-2">{t("mcpSetupStep1Label")}</p>
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <code className="text-xs flex-1 min-w-0 overflow-x-auto">{MCP_URL}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyUrl} aria-label={copied ? "Copied" : "Copy URL"}>
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2: Add to Claude */}
          <div className="flex gap-3 items-start">
            <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-2">{t("mcpSetupStep2Label")}</p>
              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-semibold text-foreground mb-1.5">
                    {t("mcpSetupStep2AiTitle")} <span className="text-green-500 font-normal">{t("mcpSetupStep2Recommended")}</span>
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("mcpSetupStep2AiDesc")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-xs font-semibold text-foreground mb-1.5">{t("mcpSetupStep2CodeTitle")}</p>
                  <div className="flex items-center gap-2 bg-muted rounded px-2 py-1.5">
                    <div className="flex-1 min-w-0 overflow-x-auto">
                      <code className="text-xs text-muted-foreground whitespace-nowrap">claude mcp add --transport http qualia {MCP_URL}</code>
                    </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={copyCmd} aria-label={copiedCmd ? "Copied" : "Copy command"}>
                      {copiedCmd ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Authorize */}
          <div className="flex gap-3 items-start">
            <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1">{t("mcpSetupStep3Label")}</p>
              <p className="text-xs text-muted-foreground">
                {t("mcpSetupStep3Desc")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-1">
          <Button className="flex-1" onClick={handleDone}>
            {onDone ? t("mcpSetupCopyPrompt") : t("mcpSetupDone")}
          </Button>
          {onDone && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("mcpSetupSkip")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}