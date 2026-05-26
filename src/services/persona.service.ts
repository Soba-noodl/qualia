import { supabase } from "@/integrations/supabase/client";

export interface PersonaItem {
  id: string;
  name: string;
  description: string;
}

export async function listPersonas(projectId: string): Promise<PersonaItem[]> {
  const { data, error } = await supabase
    .from("project_personas")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
}
