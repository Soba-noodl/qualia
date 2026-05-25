import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  FolderOpen,
  FileSearch,
  ThumbsUp,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Logo from "@/components/Logo";
import AppVersionBadge from "@/components/AppVersionBadge";
import DateRangeFilter from "@/components/DateRangeFilter";
import { DateRange } from "react-day-picker";
import { format, eachDayOfInterval, subDays } from "date-fns";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAnalyticsData } from "@/hooks/use-analytics";
import { useAnalyticsTour } from "@/hooks/use-product-tour";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOrganization } from "@/hooks/use-organizations";
import type { AnalyticsScope } from "@/services/analytics.service";
import { useViewScope } from "@/hooks/use-view-scope";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { scoreToBadgeClasses } from "@/lib/score-colors";
import { ErrorState } from "@/components/ui/error-state";

const USEFUL_RATING_THRESHOLD = 4;

const Analytics = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const { data: org } = useMyOrganization();
  const [analyticsScope, setAnalyticsScope] = useViewScope() as [AnalyticsScope, (s: AnalyticsScope) => void];
  const orgId = analyticsScope === "team" ? (org?.id ?? null) : null;
  const { data, isLoading: loading, isError: analyticsIsError, error: analyticsError, refetch: refetchAnalytics } = useAnalyticsData(dateRange, analyticsScope, orgId);
  const { startTour, destroyTour } = useAnalyticsTour();
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const audits = useMemo(() => data?.audits ?? [], [data]);

  useEffect(() => {
    if (!loading && user) startTour();
    return () => destroyTour();
  }, [loading, user, startTour, destroyTour]);

  const metrics = useMemo(() => {
    const totalProjects = projects.length;
    const totalAudits = audits.length;
    const usefulCount = audits.filter(
      (a) => a.feedback_rating != null && a.feedback_rating >= USEFUL_RATING_THRESHOLD
    ).length;
    const iterationsCount = audits.filter(
      (a) => a.follow_up_audit_id != null && a.status === "completed"
    ).length;
    const auditsPerProject =
      totalProjects > 0 ? (totalAudits / totalProjects).toFixed(1) : "0";
    return {
      totalProjects,
      totalAudits,
      usefulCount,
      iterationsCount,
      auditsPerProject,
    };
  }, [projects, audits]);

  const chartData = useMemo(() => {
    if (audits.length === 0) return [];
    const endDate = dateRange?.to || new Date();
    const fallbackStart = dateRange
      ? subDays(endDate, 30)
      : new Date(audits.reduce((earliest, a) =>
          a.created_at < earliest ? a.created_at : earliest
        , audits[0].created_at));
    const startDate = dateRange?.from || fallbackStart;
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayAudits = audits.filter(
        (a) => format(new Date(a.created_at), "yyyy-MM-dd") === dayStr
      );
      const withScore = dayAudits.filter(
        (a) => a.status === "completed" && a.overall_score != null
      );
      const avgScore =
        withScore.length > 0
          ? Math.round(
              withScore.reduce((sum, a) => sum + (a.overall_score ?? 0), 0) / withScore.length
            )
          : null;
      return {
        date: format(day, "MMM d"),
        audits: dayAudits.length,
        avgScore,
      };
    });
  }, [audits, dateRange]);

  const scoreByProject = useMemo(() => {
    return projects.map((proj) => {
      const projAudits = audits.filter((a) => a.project_id === proj.id);
      const withScore = projAudits.filter((a) => a.overall_score != null);
      const avgScore =
        withScore.length > 0
          ? Math.round(
              withScore.reduce((sum, a) => sum + (a.overall_score ?? 0), 0) / withScore.length
            )
          : null;
      const lastAudit =
        projAudits.length > 0
          ? projAudits.reduce((latest, a) =>
              new Date(a.created_at) > new Date(latest.created_at) ? a : latest
            )
          : null;
      return {
        projectId: proj.id,
        projectName: proj.name,
        auditCount: projAudits.length,
        avgScore,
        lastAuditAt: lastAudit ? lastAudit.created_at : null,
      };
    }).filter((row) => row.auditCount > 0);
  }, [projects, audits]);

  const recentAudits = useMemo(() => {
    return audits.slice(0, 10).map((audit) => {
      const project = projects.find((p) => p.id === audit.project_id);
      return {
        ...audit,
        projectName: project?.name || "Unknown",
      };
    });
  }, [audits, projects]);

  if (analyticsIsError) {
    return (
      <ErrorState
        message={analyticsError instanceof Error ? analyticsError.message : "Couldn't load analytics data"}
        onRetry={() => void refetchAnalytics()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" />

      <header className="relative z-10 border-b border-border glass">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Logo size="md" />
            <AppVersionBadge />
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard">{t("dashboard")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("analyticsTitle")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              {t("analyticsTitle")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("analyticsSubtitle")}</p>
          </div>
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>

        <div role="group" aria-label={t("analyticsScope") ?? "Analytics scope"} className="flex bg-surface-1 border border-border rounded-lg p-1 gap-1 w-fit mb-8">
          <button
            onClick={() => setAnalyticsScope("personal")}
            aria-pressed={analyticsScope === "personal"}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              analyticsScope === "personal"
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("togglePersonal")}
          </button>
          {org && (
            <button
              onClick={() => setAnalyticsScope("team")}
              aria-pressed={analyticsScope === "team"}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                analyticsScope === "team"
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {org.name}
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-surface-1 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-tour="analytics-big-numbers">
              <Card className="glass border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("totalProjects")}
                  </CardTitle>
                  <FolderOpen className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{metrics.totalProjects}</div>
                </CardContent>
              </Card>

              <Card className="glass border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("totalAudits")}
                  </CardTitle>
                  <FileSearch className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{metrics.totalAudits}</div>
                </CardContent>
              </Card>

              <Card className="glass border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("usefulAudits")}
                  </CardTitle>
                  <ThumbsUp className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{metrics.usefulCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t("usefulAuditsDesc")}</p>
                </CardContent>
              </Card>

              <Card className="glass border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("iterations")}
                  </CardTitle>
                  <RefreshCw className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{metrics.iterationsCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">{t("iterationsDesc")}</p>
                </CardContent>
              </Card>
            </div>

            {projects.length === 0 && audits.length === 0 && (
              <div className="mb-10 mt-4 flex flex-col items-center justify-center text-center gap-4 glass rounded-xl border border-border px-6 py-10">
                <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center">
                  <FileSearch className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1 max-w-md">
                  <p className="text-sm font-medium text-foreground">{t("noDataForPeriod")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("analyticsSubtitle")}
                  </p>
                </div>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  {t("dashboard")}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" data-tour="analytics-charts">
              <Card className="glass border-border">
                <CardHeader>
                  <CardTitle className="text-lg">{t("auditsOverTime")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div role="img" aria-label={t("auditsOverTime")} className="outline-none">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                          <Bar dataKey="audits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      {t("noDataForPeriod")}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass border-border">
                <CardHeader>
                  <CardTitle className="text-lg">{t("scoreOverTime")}</CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">{t("scoreOverTimeDesc")}</p>
                </CardHeader>
                <CardContent>
                  {chartData.some((d) => d.avgScore != null) ? (
                    <div role="img" aria-label={t("scoreOverTime")} className="outline-none">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number | null) => (value != null ? [value, t("avgScore")] : [])}
                        />
                          <Line
                          type="monotone"
                          dataKey="avgScore"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", r: 3 }}
                          connectNulls
                          name={t("avgScore")}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      {t("noDataForPeriod")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {scoreByProject.length > 0 && (
              <Card className="glass border-border mb-8" data-tour="analytics-score-by-project">
                <CardHeader>
                  <CardTitle className="text-lg">{t("scoreByProject")}</CardTitle>
                  <p className="text-sm text-muted-foreground font-normal">{t("scoreByProjectDesc")}</p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("project")}
                          </th>
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("audits")}
                          </th>
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("avgScore")}
                          </th>
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("lastAudit")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreByProject.map((row) => (
                          <tr
                            key={row.projectId}
                            className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm font-medium">{row.projectName}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">{row.auditCount}</td>
                            <td className="py-3 px-4">
                              {row.avgScore !== null ? (
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scoreToBadgeClasses(row.avgScore)}`}
                                >
                                  {row.avgScore}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {row.lastAuditAt
                                ? formatDate(row.lastAuditAt)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="glass border-border" data-tour="analytics-recent-audits">
              <CardHeader>
                <CardTitle className="text-lg">{t("recentAudits")}</CardTitle>
              </CardHeader>
              <CardContent>
                {recentAudits.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("project")}
                          </th>
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("date")}
                          </th>
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("score")}
                          </th>
                          <th scope="col" className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                            {t("useful")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentAudits.map((audit) => (
                          <tr
                            key={audit.id}
                            className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm font-medium">{audit.projectName}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {formatDateTime(audit.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              {audit.overall_score !== null ? (
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${scoreToBadgeClasses(audit.overall_score)}`}
                                >
                                  {audit.overall_score}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {audit.feedback_rating != null ? (
                                <span className="text-muted-foreground">
                                  {audit.feedback_rating}/5
                                  {audit.feedback_rating >= USEFUL_RATING_THRESHOLD && (
                                    <span className="text-green-500 ml-1">✓</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{t("noFeedback")}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    {t("noDataForPeriod")}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Analytics;
