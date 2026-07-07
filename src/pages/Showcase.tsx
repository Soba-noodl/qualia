import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { posthog } from "@/lib/posthog";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";
import ShowcaseCard from "@/components/showcase/ShowcaseCard";
import { useShowcaseList } from "@/hooks/use-showcase";

const Showcase = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, loading } = useAuth();
  const { data: rows = [], isLoading, isError } = useShowcaseList();

  useEffect(() => {
    document.title = "Qualia · Real audits of real products";
    posthog.capture("showcase_index_viewed", { locale: language });
    return () => {
      document.title = "Qualia – UX Interface Auditing";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignupCta = (position: "top_pitch" | "bottom") => {
    posthog.capture("showcase_cta_clicked", { position, locale: language });
    if (user) navigate("/dashboard");
    else navigate("/auth?mode=signup");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link
                to="/home"
                className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                <Logo size="md" />
              </Link>
              <Link to="/showcase" className="text-sm text-primary font-medium hidden sm:inline">
                {t("showcaseNavLabel")}
              </Link>
              <Link
                to="/use-cases"
                className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline"
              >
                {t("useCasesNavLabel")}
              </Link>
              <Link
                to="/teams"
                className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline"
              >
                {t("teamsNavLabel")}
              </Link>
              <Link
                to="/plugin"
                className="text-sm text-foreground hover:text-primary transition-colors hidden sm:inline"
              >
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
        {/* Hero — same shape as the other marketing pages */}
        <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 [text-wrap:balance] text-gradient">
              {t("showcasePitchTitle")}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto [text-wrap:balance]">
              {t("showcasePitchSubtitle")}
            </p>
            <div className="mt-8 flex justify-center">
              <Button onClick={() => handleSignupCta("top_pitch")} size="lg" className="glow-purple">
                {t("showcaseTryCta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <section className="pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">

            {isLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-border bg-card p-5 animate-pulse"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                      <div className="h-10 w-16 bg-muted rounded" />
                    </div>
                    <div className="aspect-[16/7] bg-muted rounded-lg mb-4" />
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-1/4" />
                      <div className="h-4 bg-muted rounded" />
                      <div className="h-4 bg-muted rounded w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-foreground">{t("showcaseError")}</p>
              </div>
            )}

            {!isLoading && !isError && rows.length > 0 && (() => {
              const ownWork = rows.filter((r) => r.section === "own_work");
              const publicExamples = rows.filter((r) => r.section === "public_examples");
              return (
                <div className="space-y-12">
                  {ownWork.length > 0 && (
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                        {t("showcaseSectionOwnWorkTitle")}
                      </h2>
                      <p className="text-sm text-muted-foreground mb-6">
                        {t("showcaseSectionOwnWorkSubtitle")}
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {ownWork.map((row) => (
                          <ShowcaseCard key={row.slug} row={row} />
                        ))}
                      </div>
                    </div>
                  )}
                  {publicExamples.length > 0 && (
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
                        {t("showcaseSectionPublicExamplesTitle")}
                      </h2>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {publicExamples.map((row) => (
                          <ShowcaseCard key={row.slug} row={row} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Bottom CTA */}
            <div className="mt-16 pt-12 border-t border-border text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                {t("showcaseBottomTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-xl mx-auto">
                {t("showcaseBottomBody")}
              </p>
              <Button size="lg" onClick={() => handleSignupCta("bottom")}>
                {t("showcaseStartAuditCta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
};

export default Showcase;
