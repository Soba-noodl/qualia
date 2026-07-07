import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Lightbulb,
  MousePointer2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { posthog } from "@/lib/posthog";
import Logo from "@/components/Logo";
import ScoreCard from "@/components/ScoreCard";
import AuditContextCard from "@/components/AuditContextCard";
import BrandLogo from "@/components/showcase/BrandLogo";
import FlowImageCarousel from "@/components/audit/FlowImageCarousel";
import { useShowcaseAudit, showcaseScreenUrl } from "@/hooks/use-showcase";
import { mergeShowcaseTranslations, mergeShowcaseContext } from "@/lib/translations/mergeShowcaseTranslations";
import { getMarkerColor } from "@/lib/markerColors";
import { scoreToTailwindColor } from "@/lib/score-colors";
import { getPrincipleDescription } from "@/lib/uxTaxonomy";
import { cn } from "@/lib/utils";
import type { AiReport, FlowIssueData, BoundingBox } from "@/services/audit.service";

type EngineId = "system_logic" | "heuristic" | "cognitive" | "interaction";

interface EngineEntry {
  id: EngineId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  findings: FlowIssueData[];
}

function boxToMarkerPosition(box: BoundingBox): { x: number; y: number } | null {
  if (!box || !Array.isArray(box) || box.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box;
  if (!box.every((v) => Number.isFinite(v))) return null;
  if (ymin >= ymax || xmin >= xmax) return null;
  if (ymin < -50 || ymax > 1050 || xmin < -50 || xmax > 1050) return null;
  const cy = (ymin + ymax) / 20;
  const cx = (xmin + xmax) / 20;
  const clamp = (n: number) => Math.max(5, Math.min(95, n));
  return { x: clamp(cx), y: clamp(cy) };
}

type FlatIssue = {
  id: string;
  markerIndex: number | null;
  engineId: EngineId;
  finding: FlowIssueData;
  location: { x: number; y: number } | null;
  imageIndex: number | null;
  isGeneral: boolean;
};

function getEngineStatus(findings: { issue: string }[]): "good" | "warning" | "critical" {
  if (findings.length === 0) return "good";
  if (findings.length <= 2) return "warning";
  return "critical";
}

function getStatusBg(status: "good" | "warning" | "critical"): string {
  if (status === "good") return "bg-green-500/10 border-green-500/30";
  if (status === "warning") return "bg-amber-500/10 border-amber-500/30";
  return "bg-red-500/10 border-red-500/30";
}

const ShowcaseAudit = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { data: row, isLoading, isError } = useShowcaseAudit(slug);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null);
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);
  const issueRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const aiReport: AiReport | null = useMemo(() => {
    if (!row) return null;
    return mergeShowcaseTranslations(row.ai_report, row.translations, language);
  }, [row, language]);

  const context = useMemo(() => {
    if (!row) return null;
    return mergeShowcaseContext(
      {
        project_mission: row.project_mission,
        screen_context: row.screen_context,
        selected_personas: row.selected_personas,
      },
      row.translations,
      language,
    );
  }, [row, language]);

  const engines: EngineEntry[] = useMemo(() => {
    if (!aiReport) return [];
    return [
      {
        id: "system_logic",
        title: language === "it" ? "Logica di Sistema" : "System Logic",
        icon: Workflow,
        description:
          language === "it"
            ? "Architettura, sequenza logica, consistenza degli stati"
            : "Architecture, logical sequence, state consistency",
        findings: aiReport.engines.system_logic ?? [],
      },
      {
        id: "heuristic",
        title: language === "it" ? "Euristiche & Navigazione" : "Heuristic & Navigation",
        icon: Compass,
        description:
          language === "it"
            ? "Euristiche di Nielsen, wayfinding, modelli mentali"
            : "Nielsen's heuristics, wayfinding, mental models",
        findings: aiReport.engines.heuristic ?? [],
      },
      {
        id: "cognitive",
        title: language === "it" ? "Cognitiva & Visiva" : "Cognitive & Visual",
        icon: Eye,
        description:
          language === "it" ? "Gerarchia visiva, carico cognitivo" : "Visual hierarchy, cognitive load",
        findings: aiReport.engines.cognitive ?? [],
      },
      {
        id: "interaction",
        title: language === "it" ? "Costo di Interazione" : "Interaction Cost",
        icon: MousePointer2,
        description:
          language === "it"
            ? "Legge di Fitts, profondità di click, attrito input"
            : "Fitts's Law, click depth, input friction",
        findings: aiReport.engines.interaction ?? [],
      },
    ];
  }, [aiReport, language]);

  // Build flat issue list (only localized issues get a marker index)
  const issues: FlatIssue[] = useMemo(() => {
    if (!aiReport) return [];
    const out: FlatIssue[] = [];
    let markerIndex = 0;
    for (const engine of engines) {
      engine.findings.forEach((f, j) => {
        const loc = boxToMarkerPosition(f.box_2d ?? null);
        out.push({
          id: `${engine.id}-${j}`,
          markerIndex: loc ? markerIndex++ : null,
          engineId: engine.id,
          finding: f,
          location: loc,
          imageIndex: typeof f.image_index === "number" ? f.image_index : null,
          isGeneral: !loc,
        });
      });
    }
    return out;
  }, [aiReport, engines]);

  const imageUrls: string[] = useMemo(
    () => (row?.public_flow_images ?? []).map(showcaseScreenUrl),
    [row?.public_flow_images],
  );

  const isFlowMode = imageUrls.length > 1;

  const getSubScore = (engineId: EngineId, findings: { issue: string }[]) => {
    if (aiReport?.sub_scores) {
      const k = `${engineId}_score` as keyof typeof aiReport.sub_scores;
      const v = aiReport.sub_scores[k];
      if (typeof v === "number") return v;
    }
    const baseScore = 100;
    const deduction = Math.min(findings.length * 10, 40);
    return Math.max(baseScore - deduction, 0);
  };

  // Title + analytics
  useEffect(() => {
    if (!row || !aiReport) return;
    document.title = `Qualia audit: ${row.project_name}, ${aiReport.score}/100`;
    posthog.capture("showcase_audit_opened", { slug: row.slug, locale: language });
    return () => {
      document.title = "Qualia – UX Interface Auditing";
    };
  }, [row, aiReport, language]);

  const handleSignupCta = (position: "detail_sticky" | "detail_bottom") => {
    posthog.capture("showcase_cta_clicked", { position, slug: row?.slug, locale: language });
    if (user) navigate("/dashboard");
    else navigate("/auth?mode=signup");
  };

  const toggleEngine = (id: string) => setExpandedEngine(expandedEngine === id ? null : id);

  const handleMarkerClick = (issueId: string) => {
    const issue = issues.find((i) => i.id === issueId);
    if (issue?.imageIndex != null) {
      setCurrentSlideIndex(issue.imageIndex);
    }
    // Open the engine that owns this finding
    if (issue) {
      setExpandedEngine(issue.engineId);
    }
    setHighlightedIssueId(issueId);
    setTimeout(() => setHighlightedIssueId(null), 1500);
    setTimeout(() => {
      const el = issueRefs.current.get(issueId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleIssueCardClick = (issueId: string) => {
    const issue = issues.find((i) => i.id === issueId);
    if (issue?.imageIndex != null) {
      setCurrentSlideIndex(issue.imageIndex);
    }
    setHighlightedIssueId(issueId);
    setTimeout(() => setHighlightedIssueId(null), 1500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("showcaseLoading")}</p>
      </div>
    );
  }

  if (isError || !row || !aiReport || !context) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold text-foreground">{t("showcaseNotFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          {t("showcaseNotFoundBody")}
        </p>
        <Link
          to="/showcase"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("showcaseBackToShowcase")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Standard marketing header, same nav as other public pages */}
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
              <Link
                to="/showcase"
                className="text-sm text-primary font-medium hidden sm:inline"
              >
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
              {authLoading ? (
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
                  <Button onClick={() => handleSignupCta("detail_sticky")}>
                    {t("landingGetStarted")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          {/* Back-to-showcase breadcrumb */}
          <Link
            to="/showcase"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("showcaseBackToShowcase")}
          </Link>

          {/* Project header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <BrandLogo slug={row.slug} size={28} />
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                {row.project_name}
              </h1>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
              {context.projectMission}
            </p>
          </div>

          <div className="space-y-6">
            {/* Overall Score */}
            <div className="glass rounded-xl p-6 glow-border">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ScoreCard score={aiReport.score} />
                <div className="flex-1 w-full">
                  <p className="text-xs text-muted-foreground text-center mb-2">
                    {language === "it" ? "Punteggio = Media di 4 dimensioni" : "Score = Average of 4 dimensions"}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {engines.map((engine) => {
                      const subScore = getSubScore(engine.id, engine.findings);
                      return (
                        <div
                          key={engine.id}
                          className="text-center p-3 rounded-lg bg-surface-1/50 border border-border/30"
                        >
                          <engine.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <div className={cn("text-lg font-bold", scoreToTailwindColor(subScore))}>
                            {subScore}
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-tight">
                            {engine.title.split(" ")[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* One Big Thing */}
            <div className="glass rounded-xl p-6 border-2 border-primary/30 glow-purple">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-semibold">
                      {language === "it" ? "L'Insight Principale" : "One Big Thing"}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-foreground">
                      {language === "it" ? "Cambio ad Alto Impatto" : "High Leverage Change"}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{aiReport.one_big_thing}</p>
                </div>
              </div>
            </div>

            {/* Flow image carousel + Detailed Breakdown */}
            <div className={cn("grid gap-6", isFlowMode ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
              {imageUrls.length > 0 && (
                <div className={isFlowMode ? "lg:col-span-2" : ""}>
                  <div className={isFlowMode ? "lg:sticky lg:top-24 space-y-6 h-fit" : "space-y-6"}>
                    <FlowImageCarousel
                      images={imageUrls}
                      projectName={row.project_name}
                      issues={issues.map((i) => ({
                        id: i.id,
                        markerIndex: i.markerIndex,
                        issue: i.finding.issue,
                        location: i.location,
                        isGeneral: i.isGeneral,
                        engineId: i.engineId,
                        imageIndex: i.imageIndex,
                      }))}
                      currentSlideIndex={currentSlideIndex}
                      onSlideChange={setCurrentSlideIndex}
                      hoveredIssueId={hoveredIssueId}
                      onMarkerHover={setHoveredIssueId}
                      onMarkerClick={handleMarkerClick}
                      highlightedIssueId={highlightedIssueId}
                    />

                    {/* Audit context, same component the authenticated page uses */}
                    <AuditContextCard
                      screenGoal={context.screenContext || null}
                      isFlowAudit={isFlowMode}
                      mission={context.projectMission}
                      personas={context.personas.map((p, i) => ({
                        id: `persona-${i}`,
                        name: p.name,
                        description: p.description,
                      }))}
                      selectedPersonaNames={context.personas.map((p) => p.name)}
                      constraints={null}
                      contextImages={null}
                    />
                  </div>
                </div>
              )}

              <div className={cn("space-y-4", isFlowMode ? "lg:col-span-3" : "")}>
                <h2 className="text-lg font-semibold">
                  {language === "it" ? "Analisi Dettagliata" : "Detailed Breakdown"}
                </h2>

                {engines.map((engine) => {
                  const status = getEngineStatus(engine.findings);
                  const engineScore = getSubScore(engine.id, engine.findings);
                  const isExpanded = expandedEngine === engine.id;
                  return (
                    <div
                      key={engine.id}
                      className={cn(
                        "glass rounded-xl overflow-hidden border transition-all",
                        getStatusBg(status),
                      )}
                    >
                      {/* eslint-disable-next-line react/forbid-elements, jsx-a11y/control-has-associated-label -- DS-PRIMITIVE-001: engine accordion header; nested h3+text content provides accessible name; same pattern as AuditDetail */}
                      <button
                        onClick={() => toggleEngine(engine.id)}
                        aria-expanded={isExpanded}
                        className="w-full p-5 flex items-center gap-4 text-left hover:bg-surface-1/50 transition-colors"
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            status === "good" && "bg-green-500/20",
                            status === "warning" && "bg-amber-500/20",
                            status === "critical" && "bg-red-500/20",
                          )}
                        >
                          <engine.icon
                            className={cn(
                              "h-5 w-5",
                              status === "good" && "text-green-400",
                              status === "warning" && "text-amber-400",
                              status === "critical" && "text-red-400",
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{engine.title}</h3>
                          <p className="text-sm text-muted-foreground">{engine.description}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={cn("text-2xl font-bold", scoreToTailwindColor(engineScore))}>
                            {engineScore}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {engine.findings.length}{" "}
                              {engine.findings.length === 1
                                ? language === "it"
                                  ? "rilievo"
                                  : "issue"
                                : language === "it"
                                  ? "rilievi"
                                  : "issues"}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </button>

                      {isExpanded && engine.findings.length > 0 && (
                        <div className="px-5 pb-5 space-y-3 border-t border-border/50 pt-4">
                          {engine.findings.map((finding, idx) => {
                            const issueId = `${engine.id}-${idx}`;
                            const issueData = issues.find((i) => i.id === issueId);
                            const isHovered = hoveredIssueId === issueId;
                            const isHighlighted = highlightedIssueId === issueId;
                            const isGeneral = issueData?.isGeneral ?? true;
                            const markerIndex =
                              typeof issueData?.markerIndex === "number"
                                ? issueData.markerIndex
                                : null;
                            const imageIndex = issueData?.imageIndex;
                            const hasImageIndex = isFlowMode && typeof imageIndex === "number";

                            return (
                              <div
                                key={idx}
                                ref={(el) => {
                                  if (el) issueRefs.current.set(issueId, el);
                                  else issueRefs.current.delete(issueId);
                                }}
                                className={cn(
                                  "p-4 rounded-lg bg-surface-1/50 transition-all duration-200",
                                  isHovered && !isGeneral && "ring-2 ring-primary/50 bg-primary/10",
                                  isHighlighted &&
                                    "animate-highlight-pulse ring-2 ring-primary bg-primary/20",
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex items-start gap-3",
                                    !isGeneral &&
                                      "cursor-pointer hover:bg-surface-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                  )}
                                  onMouseEnter={() =>
                                    !isGeneral && setHoveredIssueId(issueId)
                                  }
                                  onMouseLeave={() => setHoveredIssueId(null)}
                                  {...(!isGeneral
                                    ? {
                                        role: "button" as const,
                                        tabIndex: 0,
                                        onClick: () => handleIssueCardClick(issueId),
                                        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            handleIssueCardClick(issueId);
                                          }
                                        },
                                      }
                                    : {})}
                                >
                                  {!isGeneral && markerIndex !== null ? (
                                    <div
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                      style={{ backgroundColor: getMarkerColor(markerIndex) }}
                                      aria-hidden="true"
                                    >
                                      {markerIndex + 1}
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/20 shrink-0">
                                      <span className="text-sm" aria-hidden="true">💡</span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    {hasImageIndex && (
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-foreground font-medium">
                                          {language === "it" ? "Schermata" : "Step"}{" "}
                                          {(imageIndex ?? 0) + 1}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {language === "it" ? "Clicca per vedere" : "Click to view"}
                                        </span>
                                      </div>
                                    )}
                                    <p className="font-semibold text-sm text-foreground mb-3 leading-relaxed whitespace-pre-line">
                                      {finding.issue}
                                    </p>
                                    {finding.principle && finding.principle.trim() && (() => {
                                      const tag = finding.principle.trim();
                                      const description = getPrincipleDescription(tag);
                                      return (
                                        <div className="mb-3 min-w-0">
                                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary/90 bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1.5 break-words">
                                            <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                                            <span>{tag}</span>
                                          </span>
                                          {description != null && (
                                            <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-2">
                                              {description}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    {finding.why_it_matters && (
                                      <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                                        <span className="font-medium text-amber-400">
                                          {language === "it" ? "Perché conta:" : "Why it matters:"}
                                        </span>{" "}
                                        {finding.why_it_matters}
                                      </p>
                                    )}
                                    {finding.suggestion && (
                                      <div className="flex items-start gap-2.5 bg-primary/10 rounded-lg p-3 border border-primary/20">
                                        <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
                                        <p className="text-sm text-foreground/85 leading-relaxed">
                                          {finding.suggestion}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 pt-12 border-t border-border text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t("showcaseBottomTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-xl mx-auto">
              {t("showcaseBottomBody")}
            </p>
            <Button size="lg" onClick={() => handleSignupCta("detail_bottom")}>
              {t("showcaseStartAuditCta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ShowcaseAudit;
