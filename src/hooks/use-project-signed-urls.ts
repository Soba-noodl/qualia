import { useState, useEffect, useCallback, useRef } from "react";
import { createScreenshotSignedUrl } from "@/services/storage.service";
import type { Audit } from "@/hooks/use-audits";

type SignedUrlCache = Record<string, { url: string; expires: number }>;

/** Longer TTL = fewer token rotations = fewer full image re-downloads (Storage egress). */
const THUMBNAIL_SIGNED_URL_TTL_SEC = 24 * 60 * 60;
const CACHE_REFRESH_BEFORE_EXPIRY_MS = 60 * 60 * 1000; // refresh when < 1h left on 24h URL
/** Only checks whether any path needs a new URL; usually a no-op. */
const REFRESH_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Manages signed URL cache for audit screenshot paths and exposes getSignedUrl.
 * Regenerates when the list changes, when a URL is near expiry, when the tab becomes visible,
 * and on a slow interval (usually no-op) so thumbnails don't go blank after long sessions.
 */
export function useProjectSignedUrls(audits: Audit[]) {
  const [signedUrlCache, setSignedUrlCache] = useState<SignedUrlCache>({});
  const auditsRef = useRef(audits);
  auditsRef.current = audits;

  const generateSignedUrls = useCallback(async (auditList: Audit[], currentCache: SignedUrlCache) => {
    const now = Date.now();
    const urlsToGenerate: string[] = [];

    for (const audit of auditList) {
      const path = audit.screenshot_url;
      if (!path || path.startsWith("http")) continue;
      // Skip placeholder paths for pending auto-crawl audits (no file extension = directory-like placeholder)
      if (!path.includes(".")) continue;
      const cached = currentCache[path];
      if (!cached || cached.expires - now < CACHE_REFRESH_BEFORE_EXPIRY_MS) {
        urlsToGenerate.push(path);
      }
    }

    if (urlsToGenerate.length === 0) return currentCache;

    const results = await Promise.all(
      urlsToGenerate.map(async (filePath) => {
        const signedUrl = await createScreenshotSignedUrl(filePath, THUMBNAIL_SIGNED_URL_TTL_SEC);
        if (!signedUrl) {
          console.error("Failed to generate signed URL for:", filePath);
          return null;
        }
        return {
          filePath,
          signedUrl,
          expires: now + THUMBNAIL_SIGNED_URL_TTL_SEC * 1000,
        };
      })
    );

    const newCache = { ...currentCache };
    for (const result of results) {
      if (result) {
        newCache[result.filePath] = { url: result.signedUrl, expires: result.expires };
      }
    }
    return newCache;
  }, []);

  useEffect(() => {
    if (audits.length === 0) return;

    let cancelled = false;

    const run = () => {
      setSignedUrlCache((prev) => {
        void generateSignedUrls(auditsRef.current, prev).then((next) => {
          if (!cancelled) setSignedUrlCache((prev2) => ({ ...prev2, ...next }));
        });
        return prev;
      });
    };

    run();
    const interval = setInterval(run, REFRESH_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [audits.length, generateSignedUrls]);

  const getSignedUrl = useCallback(
    (filePath: string): string => {
      if (filePath.startsWith("http")) return filePath;
      const cached = signedUrlCache[filePath];
      return cached?.url || "/placeholder.svg";
    },
    [signedUrlCache]
  );

  return { getSignedUrl };
}
