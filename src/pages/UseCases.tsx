import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  MapPin,
  Brain,
  Star,
  Eye,
  ShieldCheck,
  Layers,
  Route,
  ArrowLeftRight,
  AlertTriangle,
  FileCode,
  Users,
  Quote,
} from "lucide-react";
import Logo, { LogoIcon } from "@/components/Logo";
import Footer from "@/components/Footer";
import {
  SingleScreenMockup,
  ContextImagesMockup,
  FlowAnalysisMockup,
  PrototypeCrawlMockup,
  DeepFigmaMockup,
  ContextImagesMockupCompact,
  DeepFigmaMockupCompact,
  SynthUsersMockupCompact,
} from "@/components/landing/UseCaseMockups";

const UseCases = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = t("useCasesPageTitle");
    return () => {
      document.title = "Qualia – UX Interface Auditing";
    };
  }, [t]);

  const handleCTA = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/auth?mode=signup");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 pointer-events-none" />

      {/* Sticky Navigation, same as landing */}
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
              <Link to="/plugin" className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline">
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
      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 [text-wrap:balance] text-gradient">
            {t("useCasesHeroHeadline")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto [text-wrap:balance]">
            {t("useCasesHeroSubheadline")}
          </p>
        </div>
      </section>

      {/* ─── SINGLE SCREEN AUDIT ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-1">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {t("useCasesSingleSubtitle")}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 [text-wrap:balance]">
                {t("useCasesSingleTitle")}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {t("useCasesSingleDesc")}
              </p>

              {/* Perks */}
              <div className="space-y-6">
                <PerkItem
                  icon={<MapPin className="h-4 w-4" />}
                  title={t("useCasesSinglePerk1Title")}
                  desc={t("useCasesSinglePerk1Desc")}
                />
                <PerkItem
                  icon={<Brain className="h-4 w-4" />}
                  title={t("useCasesSinglePerk2Title")}
                  desc={t("useCasesSinglePerk2Desc")}
                />
                <PerkItem
                  icon={<Star className="h-4 w-4" />}
                  title={t("useCasesSinglePerk3Title")}
                  desc={t("useCasesSinglePerk3Desc")}
                />
              </div>
            </div>

            {/* Mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                <SingleScreenMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FLOW ANALYSIS ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Route className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {t("useCasesFlowSubtitle")}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 [text-wrap:balance]">
                {t("useCasesFlowTitle")}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {t("useCasesFlowDesc")}
              </p>

              {/* Perks */}
              <div className="space-y-6">
                <PerkItem
                  icon={<ArrowLeftRight className="h-4 w-4" />}
                  title={t("useCasesFlowPerk1Title")}
                  desc={t("useCasesFlowPerk1Desc")}
                />
                <PerkItem
                  icon={<LogoIcon className="h-4 w-4" />}
                  title={t("useCasesFlowPerk2Title")}
                  desc={t("useCasesFlowPerk2Desc")}
                />
                <PerkItem
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title={t("useCasesFlowPerk3Title")}
                  desc={t("useCasesFlowPerk3Desc")}
                />
              </div>
            </div>

            {/* Mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                <FlowAnalysisMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROTOTYPE CRAWL ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-1">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Route className="h-5 w-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  {t("useCasesPrototypeSubtitle")}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 [text-wrap:balance]">
                {t("useCasesPrototypeTitle")}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {t("useCasesPrototypeDesc")}
              </p>

              {/* Perks */}
              <div className="space-y-6">
                <PerkItem
                  icon={<Route className="h-4 w-4" />}
                  title={t("useCasesPrototypePerk1Title")}
                  desc={t("useCasesPrototypePerk1Desc")}
                />
                <PerkItem
                  icon={<Layers className="h-4 w-4" />}
                  title={t("useCasesPrototypePerk2Title")}
                  desc={t("useCasesPrototypePerk2Desc")}
                />
                <PerkItem
                  icon={<FileCode className="h-4 w-4" />}
                  title={t("useCasesPrototypePerk3Title")}
                  desc={t("useCasesPrototypePerk3Desc")}
                />
              </div>
            </div>

            {/* Mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                <PrototypeCrawlMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ENHANCE YOUR AUDIT (Context + Deep Figma) ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-1">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 [text-wrap:balance]">
              {t("useCasesEnhancementsTitle")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
              {t("useCasesEnhancementsSubtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Context images card */}
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <div className="w-full max-w-[200px] mx-auto mb-6">
                <ContextImagesMockupCompact />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {t("useCasesEnhanceContextTitle")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                {t("useCasesEnhanceContextDesc")}
              </p>
              <ul className="space-y-1.5 text-sm text-foreground/85">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceContextBullet1")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceContextBullet2")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceContextBullet3")}
                </li>
              </ul>
            </div>

            {/* Deep Figma UI card */}
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <div className="w-full max-w-[200px] mx-auto mb-6">
                <DeepFigmaMockupCompact />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {t("useCasesEnhanceFigmaTitle")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                {t("useCasesEnhanceFigmaDesc")}
              </p>
              <ul className="space-y-1.5 text-sm text-foreground/85">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceFigmaBullet1")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceFigmaBullet2")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceFigmaBullet3")}
                </li>
              </ul>
            </div>

            {/* Synth users card */}
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <div className="w-full max-w-[200px] mx-auto mb-6">
                <SynthUsersMockupCompact />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {t("useCasesEnhanceSynthTitle")}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                {t("useCasesEnhanceSynthDesc")}
              </p>
              <ul className="space-y-1.5 text-sm text-foreground/85">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceSynthBullet1")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceSynthBullet2")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {t("useCasesEnhanceSynthBullet3")}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 [text-wrap:balance]">
            {t("useCasesCtaTitle")}
          </h2>
          <Button size="lg" className="glow-purple text-base px-8 py-6" onClick={handleCTA}>
            {t("useCasesCtaButton")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
};

/** Reusable perk row */
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

export default UseCases;
