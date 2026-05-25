import { useState, useEffect } from "react";

type Scope = "personal" | "team";
const STORAGE_KEY = "qualia_view_scope";

/**
 * Persists the personal/team toggle selection across page navigations for the
 * current browser session. Both Dashboard and Analytics share this hook so
 * switching scope on one page is reflected when navigating to the other.
 */
export function useViewScope(): [Scope, (s: Scope) => void] {
  const [scope, setScopeState] = useState<Scope>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored === "team" ? "team" : "personal";
    } catch {
      // intentional: sessionStorage unavailable (sandboxed iframe) — default to personal scope
      return "personal";
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, scope);
    } catch {
      // intentional: sessionStorage unavailable (e.g. Figma sandboxed iframe) — scope is in-memory only
    }
  }, [scope]);

  return [scope, setScopeState];
}
