import { useCallback, useRef, useState } from "react";
import { getDrivePickerToken } from "@/services/integration.service";

const SCRIPT_URL = "https://apis.google.com/js/api.js";

export type DrivePickerDocument = { id: string; name: string };

let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleApiScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Not in browser"));
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      const gapi = (window as unknown as { gapi?: { load: (name: string, cb: () => void) => void } }).gapi;
      if (gapi) {
        gapi.load("picker", () => resolve());
        return;
      }
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const gapi = (window as unknown as { gapi?: { load: (name: string, cb: () => void) => void } }).gapi;
      if (!gapi) {
        reject(new Error("Google API failed to load"));
        return;
      }
      gapi.load("picker", () => resolve());
    };
    script.onerror = () => reject(new Error("Failed to load Google Picker script"));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

/**
 * Walks up from the Picker elements to find which body-level containers
 * hold them, then marks every OTHER body child as inert.
 * Uses a MutationObserver so it works regardless of when Google injects elements.
 */
function createPickerGuard() {
  let observer: MutationObserver | null = null;

  function isPickerElement(el: Element): boolean {
    return (
      el.classList?.contains("picker-dialog-bg") ||
      el.classList?.contains("picker-dialog") ||
      !!el.querySelector?.(".picker-dialog-bg") ||
      !!el.querySelector?.(".picker-dialog")
    );
  }

  function applyInert() {
    const children = Array.from(document.body.children) as HTMLElement[];
    for (const el of children) {
      if (!el.setAttribute) continue;
      if (isPickerElement(el)) {
        el.removeAttribute("inert");
        continue;
      }
      el.setAttribute("inert", "");
      el.dataset.dpInerted = "1";
    }
  }

  function start() {
    applyInert();
    // Re-apply whenever Google adds/removes elements (it rebuilds the picker DOM)
    observer = new MutationObserver(() => applyInert());
    observer.observe(document.body, { childList: true });
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    const children = Array.from(document.body.children) as HTMLElement[];
    for (const el of children) {
      if (el.dataset?.dpInerted) {
        el.removeAttribute("inert");
        delete el.dataset.dpInerted;
      }
    }
  }

  return { start, stop };
}

export function useDrivePicker() {
  const [pickerError, setPickerError] = useState<Error | null>(null);
  const [isPickerReady, setIsPickerReady] = useState(false);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  // eslint-disable-next-line require-await -- returns a promise chain; dropping async would widen the inferred return type
  const ensurePickerReady = useCallback(async (): Promise<void> => {
    if (initPromiseRef.current) return initPromiseRef.current;
    setPickerError(null);
    initPromiseRef.current = loadGoogleApiScript()
      .then(() => setIsPickerReady(true))
      .catch((err) => {
        setPickerError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      });
    return initPromiseRef.current;
  }, []);

  const openDrivePicker = useCallback(async (): Promise<DrivePickerDocument[]> => {
    const appId = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined;
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
    if (!appId?.trim()) {
      const err = new Error("Google Picker is not configured (missing VITE_GOOGLE_APP_ID)");
      setPickerError(err);
      throw err;
    }

    await ensurePickerReady();

    const accessToken = await getDrivePickerToken();

    const gapi = (window as unknown as { gapi?: unknown }).gapi;
    const google = (window as unknown as { google?: { picker?: unknown } }).google;
    if (!google?.picker || !gapi) {
      const err = new Error("Google Picker failed to load");
      setPickerError(err);
      throw err;
    }

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pickerApi = google.picker as any;
      const guard = createPickerGuard();

      const callback = (data: { action?: string }) => {
        if (data.action === pickerApi.Action.CANCEL) {
          guard.stop();
          reject(new Error("CANCELLED"));
          return;
        }
        if (data.action !== pickerApi.Action.PICKED) {
          return;
        }
        guard.stop();
        const docsRaw = data[pickerApi.Response.DOCUMENTS] as Array<{ [key: string]: unknown }> | undefined;
        if (!docsRaw?.length) {
          resolve([]);
          return;
        }
        const docs: DrivePickerDocument[] = docsRaw.map((doc) => ({
          id: String(doc[pickerApi.Document.ID] ?? ""),
          name: String(doc[pickerApi.Document.NAME] ?? "Untitled"),
        }));
        resolve(docs);
      };

      const builder = new pickerApi.PickerBuilder();
      builder.setOAuthToken(accessToken).setAppId(appId);
      if (apiKey?.trim()) builder.setDeveloperKey(apiKey.trim());
      builder
        .addView(pickerApi.ViewId.DOCS)
        .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
        .setCallback(callback);

      const pickerInstance = builder.build();
      if (!pickerInstance || typeof pickerInstance.setVisible !== "function") {
        reject(new Error("Picker API error: build() did not return a valid Picker"));
        return;
      }

      pickerInstance.setVisible(true);
      // Start the guard after showing -- gives the Picker a moment to inject its DOM
      setTimeout(() => guard.start(), 100);
    });
  }, [ensurePickerReady]);

  return { openDrivePicker, isPickerReady, pickerError };
}
