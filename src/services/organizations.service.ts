import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrgMember = Database["public"]["Tables"]["org_members"]["Row"];

/** Generates a cryptographically random opaque invite token. */
export function buildInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Returns true if the invite expiry timestamp has passed. */
export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export async function createOrganization(name: string): Promise<Organization> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, owner_id: user.id })
    .select()
    .single();
  if (error) {
    console.error("[createOrganization] Supabase error:", error);
    throw error;
  }
  return data;
}

export async function getMyOrganization(): Promise<Organization | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  // Check if user is an active member of any org
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membership?.org_id) {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.org_id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // Fall back: check if user owns an org
  const { data: owned } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  return owned ?? null;
}

export async function updateOrganizationName(
  orgId: string,
  name: string
): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", orgId);
  if (error) throw error;
}

export async function deleteOrganization(orgId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (countError) throw countError;
  if (count && count > 0) {
    throw new Error(
      `Cannot delete team: ${count} team project${count > 1 ? "s" : ""} still exist.`
    );
  }
  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", orgId);
  if (error) throw error;
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("org_members")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("org_members")
    .delete()
    .eq("id", memberId);
  if (error) throw error;
}

export async function cancelInvite(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("org_members")
    .delete()
    .eq("id", memberId)
    .eq("status", "pending");
  if (error) throw error;
}
