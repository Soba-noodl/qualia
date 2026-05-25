import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  Sparkles,
  Zap,
  PanelRightOpen,
  MousePointerClick,
  RotateCcw,
  Save,
} from "lucide-react";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";
import { PluginInFigmaMockup, PluginReportMockup } from "@/components/landing/PluginMockups";
import { FIGMA_PLUGIN_URL } from "@/lib/constants";
import { toast } from "@/components/ui/sonner";

const Plugin = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const isPluginAvailable = FIGMA_PLUGIN_URL !== "#";

  useEffect(() => {
    document.title = t("pluginPageTitle");
    return () => {
      document.title = "Qualia – UX Interface Auditing";
    };
  }, [t]);

  const handleCTA = () => {
    if (FIGMA_PLUGIN_URL && FIGMA_PLUGIN_URL !== "#") {
      window.open(FIGMA_PLUGIN_URL, "_blank", "noopener,noreferrer");
    } else {
      toast.info("Plugin link not configured yet. Check back shortly.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 pointer-events-none" />

      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link to="/home" className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                <Logo size="md" />
              </Link>
              <Link to="/showcase" className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline">
                {t("showcaseNavLabel")}
              </Link>
              <Link to="/use-cases" className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline">
                {t("useCasesNavLabel")}
              </Link>
              <Link to="/teams" className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline">
                {t("teamsNavLabel")}
              </Link>
              <Link to="/plugin" className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline font-medium text-primary">
                {t("pluginNavLabel")}
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {loading ? (
                <div className="w-24 h-9 bg-muted animate-pulse rounded-md" />
              ) : user ? (
                <Button onClick={() => navigate("/dashboard")}>
                  {t("landingGoToDashboard")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate("/auth")}>
                    {t("landingLogin")}
                  </Button>
                  <Button onClick={() => navigate("/auth?mode=signup")}>
                    {t("landingGetStarted")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main-content">
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 [text-wrap:balance] text-gradient">
            {t("pluginHeroHeadline")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 [text-wrap:balance]">
            {t("pluginHeroSubheadline")}
          </p>
          <Button
            size="lg"
            className="glow-purple text-base px-8 py-6"
            onClick={isPluginAvailable ? handleCTA : undefined}
            disabled={!isPluginAvailable}
          >
            {t("pluginCtaButton")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          {FIGMA_PLUGIN_URL === "#" && (
            <p className="text-sm text-muted-foreground mt-4">
              {t("pluginCtaComingSoon")}
            </p>
          )}
        </div>
      </section>

      {/* Stay in Figma */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-1">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PanelRightOpen className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {t("pluginInFigmaSubtitle")}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 [text-wrap:balance]">
                {t("pluginInFigmaTitle")}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {t("pluginInFigmaDesc")}
              </p>
              <div className="space-y-6">
                <PerkItem
                  icon={<PanelRightOpen className="h-4 w-4" />}
                  title={t("pluginInFigmaPerk1Title")}
                  desc={t("pluginInFigmaPerk1Desc")}
                />
                <PerkItem
                  icon={<Sparkles className="h-4 w-4" />}
                  title={t("pluginInFigmaPerk2Title")}
                  desc={t("pluginInFigmaPerk2Desc")}
                />
                <PerkItem
                  icon={<MousePointerClick className="h-4 w-4" />}
                  title={t("pluginInFigmaPerk3Title")}
                  desc={t("pluginInFigmaPerk3Desc")}
                />
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                <PluginInFigmaMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fast iterations */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center lg:[direction:rtl]">
            <div className="lg:[direction:ltr]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {t("pluginFastSubtitle")}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 [text-wrap:balance]">
                {t("pluginFastTitle")}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {t("pluginFastDesc")}
              </p>
              <div className="space-y-6">
                <PerkItem
                  icon={<Sparkles className="h-4 w-4" />}
                  title={t("pluginFastPerk1Title")}
                  desc={t("pluginFastPerk1Desc")}
                />
                <PerkItem
                  icon={<RotateCcw className="h-4 w-4" />}
                  title={t("pluginFastPerk2Title")}
                  desc={t("pluginFastPerk2Desc")}
                />
                <PerkItem
                  icon={<Save className="h-4 w-4" />}
                  title={t("pluginFastPerk3Title")}
                  desc={t("pluginFastPerk3Desc")}
                />
              </div>
            </div>
            <div className="flex justify-center lg:[direction:ltr]">
              <div className="w-full max-w-sm">
                <PluginReportMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 [text-wrap:balance]">
            {t("pluginCtaTitle")}
          </h2>
          <Button
            size="lg"
            className="glow-purple text-base px-8 py-6"
            onClick={isPluginAvailable ? handleCTA : undefined}
            disabled={!isPluginAvailable}
          >
            {t("pluginCtaButton")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          {FIGMA_PLUGIN_URL === "#" && (
            <p className="text-sm text-muted-foreground mt-4">
              {t("pluginCtaComingSoon")}
            </p>
          )}
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
};

const PerkItem = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary mt-0.5">
      {icon}
    </div>
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default Plugin;
