import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ContextDocumentRow =
  Database["public"]["Tables"]["project_context_documents"]["Row"];

const CONTEXT_BUCKET = "context-documents";

/** Maximum character length for the resolved additional context string. */
export const MAX_ADDITIONAL_CONTEXT_LENGTH = 4000;

/**
 * Request AI summary for a context document. Fire-and-forget — does not throw.
 * The summary is stored server-side; the returned value is for optimistic UI.
 */
export async function requestDocumentSummary(
  documentId: string
): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(
      `${supabaseUrl}/functions/v1/summarize-context`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ document_id: documentId }),
      }
    );

    if (!resp.ok) return null;
    const json = await resp.json();
    return json.summary ?? null;
  } catch (err) {
    console.error("Summary request failed:", err);
    return null;
  }
}

/**
 * Upload a file to the context-documents bucket, save extracted text in the DB.
 * Returns the created document row. Also fires a background summary request.
 */
export async function addContextDocument(
  projectId: string,
  userId: string,
  file: File,
  extractedText: string
): Promise<ContextDocumentRow> {
  // 1. Upload file to storage
  const fileExt = file.name.split(".").pop() ?? "bin";
  const storagePath = `${userId}/${projectId}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(CONTEXT_BUCKET)
    .upload(storagePath, file);

  if (uploadError) throw uploadError;

  // 2. Insert DB row with extracted text
  const { data, error } = await supabase
    .from("project_context_documents")
    .insert({
      project_id: projectId,
      source: "upload",
      storage_path: storagePath,
      content: extractedText,
      original_filename: file.name,
    })
    .select()
    .single();

  if (error) throw error;

  // 3. Fire-and-forget summary generation
  void requestDocumentSummary(data.id);

  return data;
}

/**
 * Add context from already-extracted text (no file to upload).
 * Useful when the caller already performed extraction.
 */
export async function addContextDocumentText(
  projectId: string,
  content: string,
  originalFilename: string
): Promise<ContextDocumentRow> {
  const { data, error } = await supabase
    .from("project_context_documents")
    .insert({
      project_id: projectId,
      source: "upload",
      content,
      original_filename: originalFilename,
    })
    .select()
    .single();

  if (error) throw error;

  // Fire-and-forget summary generation
  void requestDocumentSummary(data.id);

  return data;
}

/**
 * Add a context document coming from an external integration (Drive/Notion).
 * Does not upload any file, and records the external_id and source.
 */
export async function addContextDocumentFromIntegration(
  projectId: string,
  source: "drive" | "notion",
  content: string,
  originalFilename: string,
  externalId?: string
): Promise<ContextDocumentRow> {
  const { data, error } = await supabase
    .from("project_context_documents")
    .insert({
      project_id: projectId,
      source,
      content,
      original_filename: originalFilename,
      external_id: externalId ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Fire-and-forget summary generation
  void requestDocumentSummary(data.id);

  return data;
}

/** List all context documents for a project. */
export async function listContextDocuments(
  projectId: string
): Promise<ContextDocumentRow[]> {
  const { data, error } = await supabase
    .from("project_context_documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Delete a single context document (DB row + storage file). */
export async function deleteContextDocument(
  doc: ContextDocumentRow
): Promise<void> {
  // Remove file from storage if it exists
  if (doc.storage_path) {
    await supabase.storage.from(CONTEXT_BUCKET).remove([doc.storage_path]);
  }

  const { error } = await supabase
    .from("project_context_documents")
    .delete()
    .eq("id", doc.id);

  if (error) throw error;
}

/** Delete all context documents for a project. */
export async function deleteAllContextDocuments(
  projectId: string
): Promise<void> {
  const docs = await listContextDocuments(projectId);

  // Remove files from storage
  const paths = docs.map((d) => d.storage_path).filter(Boolean) as string[];
  if (paths.length > 0) {
    await supabase.storage.from(CONTEXT_BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("project_context_documents")
    .delete()
    .eq("project_id", projectId);

  if (error) throw error;
}

/**
 * Resolve all context documents for a project into a single string,
 * truncated to MAX_ADDITIONAL_CONTEXT_LENGTH.
 */
export async function resolveAdditionalContext(
  projectId: string
): Promise<string> {
  const docs = await listContextDocuments(projectId);
  if (docs.length === 0) return "";

  const concatenated = docs
    .map((d) => {
      const header = d.original_filename
        ? `--- ${d.original_filename} ---`
        : "--- document ---";
      return `${header}\n${d.content}`;
    })
    .join("\n\n");

  if (concatenated.length <= MAX_ADDITIONAL_CONTEXT_LENGTH) {
    return concatenated;
  }

  return concatenated.slice(0, MAX_ADDITIONAL_CONTEXT_LENGTH) + "\n[...truncated]";
}
