import { supabase } from "@/integrations/supabase/client";

const SCREENSHOTS_BUCKET = "screenshots";

const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 3600;

/**
 * Upload a file to the screenshots bucket at the given path.
 * @throws Error with message 'STORAGE_LIMIT' or 'PERMISSION_DENIED' when applicable
 */
export async function uploadScreenshot(filePath: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .upload(filePath, file);

  if (error) {
    if (error.message?.includes("exceeded") || error.message?.includes("quota")) {
      throw new Error("STORAGE_LIMIT");
    }
    if (error.message?.includes("permission") || error.message?.includes("denied")) {
      throw new Error("PERMISSION_DENIED");
    }
    throw error;
  }
}

/**
 * Create a signed URL for a path in the screenshots bucket.
 * If path is already a full URL (e.g. starts with "http"), returns it as-is.
 * Returns null on error.
 */
export async function createScreenshotSignedUrl(
  filePath: string,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS
): Promise<string | null> {
  if (filePath.startsWith("http")) return filePath;
  const { data, error } = await supabase.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Create signed URLs for multiple paths in the screenshots bucket.
 * Full URLs are returned as-is; storage paths get signed; errors yield placeholder.
 */
export function createScreenshotSignedUrls(
  paths: string[],
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRY_SECONDS
): Promise<string[]> {
  return Promise.all(
    paths.map((path) =>
      path.startsWith("http")
        ? Promise.resolve(path)
        : supabase.storage
            .from(SCREENSHOTS_BUCKET)
            .createSignedUrl(path, expiresInSeconds)
            .then(({ data, error }) => (error ? "/placeholder.svg" : data?.signedUrl ?? "/placeholder.svg"))
    )
  );
}

/**
 * Remove files from the screenshots bucket by path.
 * Skips paths that look like full URLs (legacy public URLs).
 */
export async function removeScreenshotPaths(paths: string[]): Promise<void> {
  const filePaths = paths.filter((p) => p && !p.startsWith("http"));
  if (filePaths.length === 0) return;
  await supabase.storage.from(SCREENSHOTS_BUCKET).remove(filePaths);
}
