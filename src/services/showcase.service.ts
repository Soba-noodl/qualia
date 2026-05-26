import { supabase } from "@/integrations/supabase/client";
import type { AiReport } from "@/services/audit.service";
import type { ShowcaseTranslations } from "@/lib/translations/mergeShowcaseTranslations";

export type ShowcaseSection = "own_work" | "public_examples";

export type ShowcaseRow = {
  slug: string;
  section: ShowcaseSection;
  display_order: number;
  translations: ShowcaseTranslations;
  public_flow_images: string[];
  audit_id: string;
  ai_report: AiReport;
  overall_score: number | null;
  screen_context: string | null;
  selected_personas: Array<{ name: string; description: string }> | null;
  audit_created_at: string;
  project_id: string;
  project_name: string;
  project_mission: string;
  project_persona: string;
  project_language: string | null;
};

export async function listShowcaseAudits(): Promise<ShowcaseRow[]> {
  const { data, error } = await supabase
    .from("public_showcase_audit" as never)
    .select("*")
    .order("section", { ascending: true })
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShowcaseRow[];
}

export async function getShowcaseAuditBySlug(slug: string): Promise<ShowcaseRow | null> {
  const { data, error } = await supabase
    .from("public_showcase_audit" as never)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ShowcaseRow | null;
}

export function showcaseScreenUrl(path: string): string {
  const { data } = supabase.storage.from("showcase-screens").getPublicUrl(path);
  return data.publicUrl;
}
