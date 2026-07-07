// src/pages/Unsubscribe.tsx

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface Preferences {
  product_updates: boolean;
  activity_digest: boolean;
  marketing: boolean;
}

type SaveStatus = "idle" | "saving" | "error";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-email-preferences`;

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [unsubscribedAll, setUnsubscribedAll] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); return; }
    fetch(`${FUNCTION_URL}?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setPrefs(data); })
      .catch(() => setNotFound(true));
  }, [token]);

  async function updatePref(field: keyof Preferences, value: boolean) {
    if (!prefs) return;
    const optimistic = { ...prefs, [field]: value };
    setPrefs(optimistic);
    setSaveStatus("saving");
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, [field]: value }),
      });
      if (!res.ok) throw new Error("failed");
      const updated = await res.json();
      setPrefs(updated);
      setSaveStatus("idle");
    } catch {
      setPrefs(prefs); // revert
      setSaveStatus("error");
    }
  }

  async function unsubscribeAll() {
    setSaveStatus("saving");
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, unsubscribe_all: true }),
      });
      if (!res.ok) throw new Error("failed");
      setPrefs({ product_updates: false, activity_digest: false, marketing: false });
      setUnsubscribedAll(true);
      setSaveStatus("idle");
    } catch {
      setSaveStatus("error");
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <p className="text-foreground font-semibold mb-2">Link not recognised</p>
          <p className="text-muted-foreground text-sm">This unsubscribe link is no longer valid. If you'd like to manage your preferences, log in to your Qualia account.</p>
        </div>
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading preferences...</p>
      </div>
    );
  }

  const categories: { key: keyof Preferences; label: string; desc: string }[] = [
    { key: "product_updates", label: "Product updates", desc: "Welcome emails and re-engagement nudges when you haven't audited in a while." },
    { key: "activity_digest", label: "Activity digest", desc: "A weekly summary of your audits, scores, and what to focus on next." },
    { key: "marketing", label: "Marketing and announcements", desc: "New features, product news, and occasional updates from the team." },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 bg-primary rounded-[4px]" />
          <span className="font-semibold text-foreground">Qualia</span>
        </div>

        {unsubscribedAll ? (
          <div>
            <p className="text-foreground font-semibold mb-2">You've been unsubscribed from all Qualia emails.</p>
            <p className="text-muted-foreground text-sm">You can re-enable emails at any time by returning to this page.</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground mb-1">Email preferences</h1>
            <p className="text-sm text-muted-foreground mb-6">Choose which emails you receive from Qualia. Changes apply immediately.</p>

            <div className="divide-y divide-border">
              {categories.map(({ key, label, desc }) => {
                const labelId = `email-pref-label-${key}`;
                return (
                <div key={key} className="flex items-start justify-between gap-4 py-4">
                  <div className="flex-1">
                    <p id={labelId} className="text-sm font-semibold text-foreground mb-1">{label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                  {/* eslint-disable-next-line react/forbid-elements -- DS-PRIMITIVE-001: toggle switch with role=switch aria-checked; w-9 h-5 rounded-full bg-primary vs bg-muted; inner translate span; Button primitive doesn't support role=switch semantics or the pill shape */}
                  <button
                    role="switch"
                    aria-checked={prefs[key]}
                    aria-labelledby={labelId}
                    onClick={() => updatePref(key, !prefs[key])}
                    disabled={saveStatus === "saving"}
                    className={`relative flex-shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${prefs[key] ? "bg-primary" : "bg-muted"}`}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-transform ${prefs[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                );
              })}
            </div>

            {saveStatus === "error" && (
              <p className="text-xs text-red-400 mt-3">Could not save your preference. Please try again.</p>
            )}

            <div className="mt-6 pt-4 border-t border-border">
              <button
                onClick={unsubscribeAll}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Unsubscribe from all Qualia emails
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
