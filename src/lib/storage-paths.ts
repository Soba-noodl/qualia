/**
 * Stable key for React effect deps when paths come from React Query / new array refs
 * with the same contents (avoids re-signing and img reloads on every poll).
 */
export function storagePathsKey(paths: string[] | null | undefined): string {
  if (!paths?.length) return "";
  return JSON.stringify(paths);
}
