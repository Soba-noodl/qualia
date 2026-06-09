import { supabase } from "@/integrations/supabase/client";
import { removeScreenshotPaths } from "./storage.service";
import { addContextDocument } from "./context-documents.service";
import type { Database } from "@/integrations/supabase/types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
/** UI-facing project type: Row with scope narrowed to our literal union for type-safe usage in components */
export type Project = Omit<ProjectRow, "scope"> & { scope?: "whole" | "section" };
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export type ProjectScope = "personal" | "team";

export async function listProjects(
  scope: ProjectScope = "personal",
  orgId?: string | null
): Promise<ProjectRow[]> {
  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (scope === "personal") {
    query = query.is("org_id", null);
  } else if (scope === "team" && orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type ContextFileInput = {
  file: File;
  extractedText: string;
};

export type CreateProjectParams = {
  name: string;
  mission: string;
  persona: string;
  constraints: string | null;
  language: string;
  personas: Array<{ name: string; description: string }>;
  userId: string;
  contextFiles?: ContextFileInput[];
  /** From create modal: 'whole' or 'section'. Defaults to 'whole'. */
  scope?: "whole" | "section";
  /** For section projects: parent product name. Ignored when scope is 'whole'. */
  product_name?: string | null;
  /** For section projects: overall product mission. Ignored when scope is 'whole'. */
  global_mission?: string | null;
  /** Org to associate the project with. Null = personal project. */
  org_id?: string | null;
};

export async function createProject(params: CreateProjectParams): Promise<ProjectRow> {
  const insertPayload: ProjectInsert = {
    name: params.name,
    mission: params.mission,
    persona: params.persona,
    constraints: params.constraints,
    language: params.language,
    user_id: params.userId,
    scope: params.scope ?? "whole",
    org_id: params.org_id ?? null,
    ...(params.scope === "section" && params.product_name != null
      ? { product_name: params.product_name }
      : {}),
    ...(params.scope === "section" && params.global_mission != null
      ? { global_mission: params.global_mission.trim() || null }
      : {}),
  };

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .insert(insertPayload)
    .select()
    .single();

  if (projectError) throw projectError;

  const personasToInsert = params.personas.map((p) => ({
    project_id: projectData.id,
    name: p.name,
    description: p.description,
  }));

  if (personasToInsert.length > 0) {
    const { error: personasError } = await supabase
      .from("project_personas")
      .insert(personasToInsert);
    if (personasError) throw personasError;
  }

  // Upload context documents if provided
  if (params.contextFiles && params.contextFiles.length > 0) {
    await Promise.all(
      params.contextFiles.map((cf) =>
        addContextDocument(
          projectData.id,
          params.userId,
          cf.file,
          cf.extractedText
        )
      )
    );
  }

  return projectData;
}

export type UpdateProjectParams = {
  name: string;
  mission: string;
  persona: string;
  constraints: string | null;
  language?: string;
  personas: Array<{ name: string; description: string }>;
  global_mission?: string | null;
};

export async function updateProject(
  projectId: string,
  params: UpdateProjectParams
): Promise<void> {
  const updatePayload: ProjectUpdate = {
    name: params.name,
    mission: params.mission,
    persona: params.persona,
    constraints: params.constraints,
    ...(params.language ? { language: params.language } : {}),
    ...(params.global_mission !== undefined
      ? { global_mission: params.global_mission?.trim() || null }
      : {}),
  };

  const { error: projectError } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", projectId);

  if (projectError) throw projectError;

  const { error: deleteError } = await supabase
    .from("project_personas")
    .delete()
    .eq("project_id", projectId);
  if (deleteError) throw deleteError;

  const personasToInsert = params.personas.map((p) => ({
    project_id: projectId,
    name: p.name.trim(),
    description: p.description.trim(),
  }));

  if (personasToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("project_personas")
      .insert(personasToInsert);
    if (insertError) throw insertError;
  }
}

export async function deleteProject(project: ProjectRow): Promise<void> {
  const { data: audits, error: fetchError } = await supabase
    .from("audits")
    .select("screenshot_url")
    .eq("project_id", project.id);

  if (fetchError) throw fetchError;

  if (audits && audits.length > 0) {
    const paths = audits.map((a) => a.screenshot_url).filter(Boolean);
    await removeScreenshotPaths(paths);
  }

  const { error: auditsError } = await supabase
    .from("audits")
    .delete()
    .eq("project_id", project.id);
  if (auditsError) throw auditsError;

  const { error: projectError } = await supabase
    .from("projects")
    .delete()
    .eq("id", project.id);
  if (projectError) throw projectError;
}

/**
 * Guards against cross-org transfers.
 * Throws if orgId is non-null and does not match the user's current org.
 */
export function assertTransferTarget(
  orgId: string | null,
  userOrgId: string | null
): void {
  if (orgId !== null && orgId !== userOrgId) {
    throw new Error("Cannot transfer project to an org you do not belong to");
  }
}

/**
 * Moves a project to a team org (orgId non-null) or makes it personal (orgId null).
 * RLS enforces authorization at the DB level — only the project owner can set org_id
 * to null; any active org member can set it to the org they belong to.
 */
export async function transferProject(
  projectId: string,
  orgId: string | null,
  userOrgId: string | null
): Promise<void> {
  assertTransferTarget(orgId, userOrgId);
  const { data, error } = await supabase
    .from("projects")
    .update({ org_id: orgId })
    .eq("id", projectId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Project not found or transfer not permitted");
  }
}
