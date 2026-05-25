import { supabase } from "@/integrations/supabase/client";

export interface PublicProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png"];

/** Throws a translation key string if the file is invalid. */
export function validateAvatarFile(file: File): void {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error("avatarInvalidType");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("avatarFileTooLarge");
  }
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  // Backed by the `get_member_profiles(uuid[])` SECURITY DEFINER function
  // (migration 20260523180000) — replaces the prior `member_profiles` view
  // that bypassed RLS. The function only returns identity columns.
  const { data, error } = await supabase
    .rpc("get_member_profiles", { p_user_ids: [userId] });
  if (error) throw error;
  const row = (data as PublicProfile[] | null)?.[0] ?? null;
  return row;
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim() })
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function uploadAvatar(file: File): Promise<string> {
  validateAvatarFile(file);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Delete old avatar from storage if one exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", user.id)
    .single();

  if (existingProfile?.avatar_url) {
    const oldPath = existingProfile.avatar_url.split("/avatars/")[1];
    if (oldPath) {
      await supabase.storage.from("avatars").remove([oldPath]);
    }
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id);
  if (updateError) throw updateError;
  return publicUrl;
}

export async function getProfileLanguage(): Promise<"en" | "it"> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "en";
  const { data } = await supabase
    .from("profiles")
    .select("language")
    .eq("user_id", user.id)
    .single();
  return (data?.language === "it" ? "it" : "en");
}

export async function updateProfileLanguage(lang: "en" | "it"): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("profiles")
    .update({ language: lang })
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function getTourState(userId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("profiles")
    .select("completed_tours")
    .eq("user_id", userId)
    .single();
  return (data?.completed_tours as Record<string, unknown>) ?? null;
}

export async function upsertTourState(userId: string, state: Record<string, unknown>): Promise<void> {
  const existing = await getTourState(userId) ?? {};
  const { error } = await supabase
    .from("profiles")
    .update({ completed_tours: { ...existing, ...state } })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeAvatar(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch current avatar URL so we can delete the storage object
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("user_id", user.id)
    .single();

  if (profile?.avatar_url) {
    const storagePath = profile.avatar_url.split("/avatars/")[1];
    if (storagePath) {
      await supabase.storage.from("avatars").remove([storagePath]);
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", user.id);
  if (error) throw error;
}
