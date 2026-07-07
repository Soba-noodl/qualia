import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLatestChangelogVersionKey } from "@/lib/changelog";

export default function AppVersionBadge() {
  const { t } = useLanguage();
  const version = t(getLatestChangelogVersionKey());

  return (
    <Link
      to="/changelog"
      className="text-[10px] font-medium px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      aria-label={`${t("changelogNavLabel")} ${version}`}
      title={`${t("changelogNavLabel")} ${version}`}
    >
      {version}
    </Link>
  );
}

