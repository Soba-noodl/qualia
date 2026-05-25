import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  Palette,
  Eye,
  ShieldCheck,
  ClipboardList,
  Target,
  Workflow,
  DollarSign,
  TrendingDown,
  HeadphonesIcon,
  BarChart3,
  Building2,
  Users,
  Zap,
  LineChart,
} from "lucide-react";
import Logo from "@/components/Logo";
import Footer from "@/components/Footer";
import {
  DesignersMockup,
  PMsMockup,
  FinanceMockup,
  ManagementMockup,
} from "@/components/landing/TeamsMockups";

const Teams = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = t("teamsPageTitle");
    return () => {
      document.title = "Qualia – UX Interface Auditing";
    };
  }, [t]);

  const handleCTA = () => {
    if (user) navigate("/settings?tab=team");
    else navigate("/auth?mode=signup");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 pointer-events-none" />

      {/* Header */}
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
            {t("teamsHeroHeadline")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto [text-wrap:balance]">
            {t("teamsHeroSubheadline")}
          </p>
        </div>
      </section>

      {/* ─── PRODUCT DESIGNERS ─── */}
      <RoleSection
        bg="bg-surface-1"
        icon={<Palette className="h-5 w-5 text-primary" />}
        subtitle={t("teamsDesignersSubtitle")}
        title={t("teamsDesignersTitle")}
        desc={t("teamsDesignersDesc")}
        perks={[
          { icon: <Eye className="h-4 w-4" />, title: t("teamsDesignersPerk1Title"), desc: t("teamsDesignersPerk1Desc") },
          { icon: <ShieldCheck className="h-4 w-4" />, title: t("teamsDesignersPerk2Title"), desc: t("teamsDesignersPerk2Desc") },
          { icon: <ClipboardList className="h-4 w-4" />, title: t("teamsDesignersPerk3Title"), desc: t("teamsDesignersPerk3Desc") },
        ]}
        mockup={<DesignersMockup />}
      />

      {/* ─── PRODUCT MANAGERS ─── */}
      <RoleSection
        icon={<Target className="h-5 w-5 text-primary" />}
        subtitle={t("teamsPMsSubtitle")}
        title={t("teamsPMsTitle")}
        desc={t("teamsPMsDesc")}
        perks={[
          { icon: <ClipboardList className="h-4 w-4" />, title: t("teamsPMsPerk1Title"), desc: t("teamsPMsPerk1Desc") },
          { icon: <Workflow className="h-4 w-4" />, title: t("teamsPMsPerk2Title"), desc: t("teamsPMsPerk2Desc") },
          { icon: <Zap className="h-4 w-4" />, title: t("teamsPMsPerk3Title"), desc: t("teamsPMsPerk3Desc") },
        ]}
        mockup={<PMsMockup />}
        reversed
      />

      {/* ─── FINANCE ─── */}
      <RoleSection
        bg="bg-surface-1"
        icon={<DollarSign className="h-5 w-5 text-primary" />}
        subtitle={t("teamsFinanceSubtitle")}
        title={t("teamsFinanceTitle")}
        desc={t("teamsFinanceDesc")}
        perks={[
          { icon: <TrendingDown className="h-4 w-4" />, title: t("teamsFinancePerk1Title"), desc: t("teamsFinancePerk1Desc") },
          { icon: <HeadphonesIcon className="h-4 w-4" />, title: t("teamsFinancePerk2Title"), desc: t("teamsFinancePerk2Desc") },
          { icon: <BarChart3 className="h-4 w-4" />, title: t("teamsFinancePerk3Title"), desc: t("teamsFinancePerk3Desc") },
        ]}
        mockup={<FinanceMockup />}
      />

      {/* ─── MANAGEMENT ─── */}
      <RoleSection
        icon={<Building2 className="h-5 w-5 text-primary" />}
        subtitle={t("teamsMgmtSubtitle")}
        title={t("teamsMgmtTitle")}
        desc={t("teamsMgmtDesc")}
        perks={[
          { icon: <Users className="h-4 w-4" />, title: t("teamsMgmtPerk1Title"), desc: t("teamsMgmtPerk1Desc") },
          { icon: <Zap className="h-4 w-4" />, title: t("teamsMgmtPerk2Title"), desc: t("teamsMgmtPerk2Desc") },
          { icon: <LineChart className="h-4 w-4" />, title: t("teamsMgmtPerk3Title"), desc: t("teamsMgmtPerk3Desc") },
        ]}
        mockup={<ManagementMockup />}
        reversed
      />

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 [text-wrap:balance]">
            {t("teamsCtaTitle")}
          </h2>
          <Button size="lg" className="glow-purple text-base px-8 py-6" onClick={handleCTA}>
            {t("teamsCtaButton")}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
};

/* ── Reusable role section ── */

interface Perk {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const RoleSection = ({
  bg,
  icon,
  subtitle,
  title,
  desc,
  perks,
  mockup,
  reversed,
}: {
  bg?: string;
  icon: React.ReactNode;
  subtitle: string;
  title: string;
  desc: string;
  perks: Perk[];
  mockup: React.ReactNode;
  reversed?: boolean;
}) => (
  <section className={`py-20 px-4 sm:px-6 lg:px-8 ${bg ?? ""}`}>
    <div className="container mx-auto max-w-5xl">
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${reversed ? "lg:[direction:rtl]" : ""}`}>
        {/* Text */}
        <div className={reversed ? "lg:[direction:ltr]" : ""}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
            <span className="text-xs font-medium text-primary uppercase tracking-wider">
              {subtitle}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 [text-wrap:balance]">
            {title}
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-8">{desc}</p>

          <div className="space-y-6">
            {perks.map((p, i) => (
              <PerkItem key={i} icon={p.icon} title={p.title} desc={p.desc} />
            ))}
          </div>
        </div>

        {/* Mockup */}
        <div className={`flex justify-center ${reversed ? "lg:[direction:ltr]" : ""}`}>
          <div className="w-full max-w-sm">
            {mockup}
          </div>
        </div>
      </div>
    </div>
  </section>
);

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

export default Teams;
