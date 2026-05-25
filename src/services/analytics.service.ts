import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

export interface AnalyticsProject {
  id: string;
  name: string;
  created_at: string;
}

export interface AnalyticsAudit {
  id: string;
  project_id: string;
  created_at: string;
  overall_score: number | null;
  feedback_rating: number | null;
  follow_up_audit_id: string | null;
  status: "pending" | "processing" | "completed" | "failed";
}

export interface AnalyticsData {
  projects: AnalyticsProject[];
  audits: AnalyticsAudit[];
}

export type AnalyticsScope = "personal" | "team";

export async function getAnalyticsData(
  dateRange: DateRange | undefined,
  scope: AnalyticsScope = "personal",
  orgId?: string | null
): Promise<AnalyticsData> {
  let projectsQuery = supabase.from("projects").select("id, name, created_at");

  if (scope === "personal") {
    projectsQuery = projectsQuery.is("org_id", null);
  } else if (scope === "team" && orgId) {
    projectsQuery = projectsQuery.eq("org_id", orgId);
  }

  const projectsRes = await projectsQuery.order("created_at", { ascending: false });
  if (projectsRes.error) throw projectsRes.error;

  const projects = projectsRes.data ?? [];
  const projectIds = projects.map((p) => p.id);

  let auditsQuery = supabase
    .from("audits")
    .select("id, project_id, created_at, overall_score, feedback_rating, follow_up_audit_id, status")
    .eq("visible_in_app", true);

  if (projectIds.length > 0) {
    auditsQuery = auditsQuery.in("project_id", projectIds);
  } else {
    // No projects in this scope — return empty audits without querying
    return { projects, audits: [] };
  }

  if (dateRange?.from) {
    const fromDate = startOfDay(dateRange.from).toISOString();
    auditsQuery = auditsQuery.gte("created_at", fromDate);
  }

  if (dateRange?.to) {
    const toDate = endOfDay(dateRange.to).toISOString();
    auditsQuery = auditsQuery.lte("created_at", toDate);
  }

  const auditsRes = await auditsQuery.order("created_at", { ascending: false });
  if (auditsRes.error) throw auditsRes.error;

  return {
    projects,
    audits: auditsRes.data ?? [],
  };
}
