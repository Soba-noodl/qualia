import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { LogoIcon } from "@/components/Logo";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import AppVersionBadge from "@/components/AppVersionBadge";

interface ProjectPageHeaderProps {
  projectName: string;
  onBack: () => void;
  backLabel: string;
}

export function ProjectPageHeader({
  projectName,
  onBack,
  backLabel,
}: ProjectPageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <header className="relative z-10 border-b border-border glass">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label={backLabel} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <LogoIcon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="text-sm sm:text-lg font-semibold truncate">{projectName}</span>
            <span className="shrink-0 hidden sm:inline">
              <AppVersionBadge />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            aria-label={t("settings")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
