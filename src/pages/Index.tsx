import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Brain, KeyRound, Link2, Menu, Route, Users, Layers } from "lucide-react";
import Logo, { LogoIcon } from "@/components/Logo";
import Footer from "@/components/Footer";
import BrandLogo from "@/components/showcase/BrandLogo";
import { KeyPasteMockup, UploadMockup, PersonaMockup, ResultsMockup } from "@/components/landing/HowItWorksMockups";
import { PrototypeCrawlMockup } from "@/components/landing/UseCaseMockups";
import { useShowcaseList } from "@/hooks/use-showcase";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const OAUTH_RETURN_KEY = "oauth_return";
const OAUTH_RETURN_NEW_PROJECT_IMPORT = "new-project-import";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: showcaseRows = [] } = useShowcaseList();

  // Set document title for landing (home) page
  useEffect(() => {
    document.title = t("landingPageTitle");
    return () => {
      document.title = "Qualia – UX Interface Auditing";
    };
  }, [t]);

  // After OAuth callback: return to Dashboard with New Project modal in import mode (only when user is ready so RequireAuth won't redirect away)
  // If logged in and on landing, redirect to dashboard (covers OAuth login return and any other logged-in visit to /)
  useEffect(() => {
    if (loading || !user) return;
    const params = new URLSearchParams(location.search);
    const integration = params.get("integration");
    const status = params.get("status");
    const isOAuthSuccess =
      (integration === "google_drive" || integration === "notion") && status === "success";
    try {
      const returnTo = sessionStorage.getItem(OAUTH_RETURN_KEY);
      if (isOAuthSuccess && returnTo === OAUTH_RETURN_NEW_PROJECT_IMPORT) {
        sessionStorage.removeItem(OAUTH_RETURN_KEY);
        navigate("/dashboard?openNewProject=import", { replace: true });
        return;
      }
      if (isOAuthSuccess && returnTo && returnTo.startsWith("/")) {
        sessionStorage.removeItem(OAUTH_RETURN_KEY);
        navigate(`${returnTo}?integration=${integration}&status=success`, { replace: true });
        return;
      }
    } catch {
      // intentional: sessionStorage unavailable or returnTo malformed — fall through to dashboard redirect below
    }
    // Logged-in user on landing (e.g. after Google auth at / or direct visit to /home) → go to dashboard
    if (location.pathname === "/home" || location.pathname === "/") {
      navigate("/dashboard", { replace: true });
    }
  }, [location.search, location.pathname, navigate, user, loading]);

  const handleCTA = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/auth?mode=signup");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none" />
      
      {/* Sticky Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + desktop nav links */}
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

            {/* Mobile: hamburger menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden text-foreground"
                  aria-label={t("openMenu")}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(100vw-2rem,320px)]">
                <SheetHeader>
                  <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 pt-4">
                  <Link
                    to="/showcase"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("showcaseNavLabel")}
                  </Link>
                  <Link
                    to="/use-cases"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("useCasesNavLabel")}
                  </Link>
                  <Link
                    to="/teams"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("teamsNavLabel")}
                  </Link>
                  <Link
                    to="/plugin"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t("pluginNavLabel")}
                  </Link>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="px-3 py-2 text-sm text-muted-foreground">{t("language")}</div>
                    <div className="px-3">
                    </div>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>

            {/* Right side: language (desktop only) + auth buttons */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
              </div>
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
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 [text-wrap:balance] text-gradient">
            {t("landingHeroHeadlineV2")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 [text-wrap:balance]">
            {t("landingHeroSubheadlineV2")}
          </p>

          {/* Hero primary + secondary CTAs */}
          <div className="flex flex-col items-center gap-3">
            <Button size="lg" className="glow-purple text-base px-8 py-6" onClick={handleCTA}>
              {t("landingHeroCtaPrimary")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Link
              to="/showcase"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {t("landingHeroCtaSecondary")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Visual: AI Providers → Qualia */}
          <div className="mt-16 flex items-center justify-center gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-xl bg-surface-1 border border-border flex items-center justify-center">
              <BrandLogo slug="gemini" size={32} />
            </div>
            <div className="w-16 h-16 rounded-xl bg-surface-1 border border-border flex items-center justify-center">
              <BrandLogo slug="anthropic" size={32} />
            </div>
            <div className="w-16 h-16 rounded-xl bg-surface-1 border border-border flex items-center justify-center">
              <BrandLogo slug="openai" size={32} />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 bg-gradient-to-r from-muted-foreground/30 to-primary/50" />
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <div className="w-12 h-0.5 bg-gradient-to-r from-primary/50 to-primary" />
            </div>
            <div className="w-16 h-16 rounded-xl bg-surface-1 border border-primary/30 flex items-center justify-center glow-border">
              <LogoIcon className="h-8 w-8" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">{t("landingHeroVisualCaption")}</p>
        </div>
      </section>

      {/* Prototype Crawl Spotlight */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-1">
        <div className="container mx-auto max-w-6xl">
          <div className="relative rounded-3xl border border-primary/20 bg-card overflow-hidden">
            {/* Decorative gradient blobs */}
            <div className="absolute -top-32 -right-32 w-[480px] h-[480px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-0 items-stretch">
              {/* Left: copy */}
              <div className="p-8 sm:p-12 flex flex-col justify-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[11px] text-muted-foreground mb-4 w-fit">
                  <BrandLogo slug="figma" size={12} />
                  {t("landingPrototypeCrawlBadge")}
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 [text-wrap:balance] leading-tight">
                  {t("landingPrototypeCrawlTitle")}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-8 max-w-md text-sm sm:text-base">
                  {t("landingPrototypeCrawlDesc")}
                </p>
                <div className="flex flex-wrap gap-3 mb-8 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Route className="h-3.5 w-3.5 text-primary/60" />
                    {t("landingPrototypeCrawlPerk1")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary/60" />
                    {t("landingPrototypeCrawlPerk2")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={() => navigate("/plugin")} className="gap-2">
                    {t("landingPrototypeCrawlCta")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Link
                    to="/use-cases"
                    className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors group"
                  >
                    {t("landingPrototypeCrawlLearnMore")}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>

              {/* Right: mockup panel */}
              <div className="relative flex items-center justify-center p-8 lg:p-8 lg:border-l border-border/50">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                <div className="relative w-full">
                  <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-3xl" />
                  <div className="relative">
                    <PrototypeCrawlMockup />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground [text-wrap:balance]">
            {t("landingFeaturesTitle")}
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            {t("landingFeaturesSubtitle")}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 0: BYOK */}
            <div className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("landingFeatureByokTitle")}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("landingFeatureByokDesc")}
              </p>
            </div>

            {/* Feature 1: Figma Integration */}
            <div className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Link2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("landingFeature1Title")}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("landingFeature1Desc")}
              </p>
            </div>

            {/* Feature 2: Flow Analysis */}
            <div className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("landingFeature2Title")}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("landingFeature2Desc")}
              </p>
            </div>

            {/* Feature 3: Synthetic Users */}
            <div className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("landingFeature3Title")}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("landingFeature3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-1">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 text-foreground [text-wrap:balance]">
            {t("landingHowItWorksTitle")}
          </h2>
          <p className="text-muted-foreground text-center mb-16 max-w-2xl mx-auto">
            {t("landingHowItWorksSubtitle")}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1, Add AI key (NEW) */}
            <div className="flex flex-col">
              <KeyPasteMockup />
              <div className="flex items-center gap-3 mb-3 mt-6">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {t("landingStepKeyTitle")}
                </h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed text-center">
                {t("landingStepKeyBody")}
              </p>
            </div>

            {/* Step 2, Upload */}
            <div className="flex flex-col">
              <UploadMockup />
              <div className="flex items-center gap-3 mb-3 mt-6">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {t("landingStep1Title")}
                </h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed text-center">
                {t("landingStep1Body")}
              </p>
            </div>

            {/* Step 3, Persona */}
            <div className="flex flex-col">
              <PersonaMockup />
              <div className="flex items-center gap-3 mb-3 mt-6">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {t("landingStep2Title")}
                </h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed text-center">
                {t("landingStep2Body")}
              </p>
            </div>

            {/* Step 4, Results */}
            <div className="flex flex-col">
              <ResultsMockup />
              <div className="flex items-center gap-3 mb-3 mt-6">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">4</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {t("landingStep3Title")}
                </h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed text-center">
                {t("landingStep3Body")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you'd miss / Showcase Proof Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground [text-wrap:balance]">
              {t("landingMissingTitleV2")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto [text-wrap:balance]">
              {t("landingMissingBodyV2")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Problem column (expanded) */}
            <div className="rounded-xl border border-border bg-surface-2 p-6 text-left flex flex-col">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive/60" />
                {t("landingProblemLabel")}
              </div>
              <h3 className="text-base font-semibold text-foreground mb-4">
                {t("landingProblemH4")}
              </h3>
              <div className="divide-y divide-border/40 flex-1">
                <div className="py-3 first:pt-0">
                  <p className="text-sm font-medium text-foreground mb-1">{t("landingProblem1Title")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("landingProblem1Body")}</p>
                </div>
                <div className="py-3">
                  <p className="text-sm font-medium text-foreground mb-1">{t("landingProblem2Title")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("landingProblem2Body")}</p>
                </div>
                <div className="py-3">
                  <p className="text-sm font-medium text-foreground mb-1">{t("landingProblem3Title")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("landingProblem3Body")}</p>
                </div>
                <div className="py-3 last:pb-0">
                  <p className="text-sm font-medium text-foreground mb-1">{t("landingProblem4Title")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("landingProblem4Body")}</p>
                </div>
              </div>
            </div>

            {/* Real findings / Showcase column */}
            <div className="rounded-xl border border-primary/30 bg-card p-6 text-left glow-border flex flex-col">
              <div className="text-xs font-medium text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {t("landingShowcaseLabel")}
              </div>
              <h3 className="text-base font-semibold text-foreground mb-4">
                {t("landingShowcaseH4")}
              </h3>
              <div className="flex-1 space-y-4">
                {(() => {
                  const ownWork = showcaseRows.filter((r) => r.section === "own_work");
                  const publicExamples = showcaseRows.filter((r) => r.section === "public_examples");
                  const renderRow = (row: typeof showcaseRows[number]) => (
                    <div key={row.slug} className="flex items-center justify-between py-2.5 first:pt-0">
                      <div className="flex items-center gap-2.5">
                        <BrandLogo slug={row.slug} size={18} />
                        <span className="text-sm font-medium text-foreground">{row.project_name}</span>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                        {row.overall_score ?? row.ai_report?.score ?? ":"}
                        <span className="text-xs">/100</span>
                      </span>
                    </div>
                  );
                  return (
                    <>
                      {ownWork.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                            {t("showcaseSectionOwnWorkTitle")}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1.5">
                            {t("showcaseSectionOwnWorkSubtitle")}
                          </p>
                          <div className="divide-y divide-border/40">
                            {ownWork.map(renderRow)}
                          </div>
                        </div>
                      )}
                      {publicExamples.length > 0 && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            {t("showcaseSectionPublicExamplesTitle")}
                          </div>
                          <div className="divide-y divide-border/40">
                            {publicExamples.map(renderRow)}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <Button
                onClick={() => navigate("/showcase")}
                className="mt-4 w-full gap-2"
              >
                {t("landingShowcaseCta")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-1">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 [text-wrap:balance]">
            {t("landingFooterCtaTitleV2")}
          </h2>
          <p className="text-muted-foreground mb-8">
            {t("landingFooterCtaSubV2")}
          </p>
          <Button size="lg" className="glow-purple text-base px-8 py-6" onClick={handleCTA}>
            {t("landingFooterCtaButton")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
