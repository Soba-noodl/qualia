import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center md:text-left">
              {t("footerBetaLine")}
            </p>
            <p className="text-sm text-muted-foreground text-center md:text-left">
              © {new Date().getFullYear()} {t("footerCopyright")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <nav aria-label={t("footerSectionProduct")} className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("footerSectionProduct")}
              </p>
              <div className="flex flex-col">
                <Link to="/showcase" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("showcaseNavLabel")}
                </Link>
                <Link to="/use-cases" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("useCasesNavLabel")}
                </Link>
                <Link to="/teams" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("teamsNavLabel")}
                </Link>
                <Link to="/plugin" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("pluginNavLabel")}
                </Link>
                <Link to="/changelog" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("changelogNavLabel")}
                </Link>
              </div>
            </nav>

            <nav aria-label={t("footerSectionCompanyLegal")} className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("footerSectionCompanyLegal")}
              </p>
              <div className="flex flex-col">
                <Link to="/about" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footerAbout")}
                </Link>
                <Link to="/faq" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("faqNavLabel")}
                </Link>
                <Link to="/contact" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footerContact")}
                </Link>
                <Link to="/privacy" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footerPrivacy")}
                </Link>
                <Link to="/cookies" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footerCookies")}
                </Link>
                <Link to="/terms" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footerTerms")}
                </Link>
                <Link to="/security" className="py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {t("footerSecurity")}
                </Link>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
