import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getTourState, upsertTourState } from "@/services/profile.service";

export type TourName =
  | "dashboard"
  | "projectCreated"
  | "projectView"
  | "auditCreation"
  | "results"
  | "analytics"
  | "userDataNudge"
  | "contextDocNudge";

export type BridgeName =
  | "after_dashboard"
  | "after_project_created"
  | "after_project_view"
  | "after_results";

export type BridgeStatus = "completed" | "dismissed" | null;

type TourState = Record<TourName, boolean>;
type BridgeState = Record<BridgeName, BridgeStatus>;

const DEFAULT_STATE: TourState = {
  dashboard: false,
  projectCreated: false,
  projectView: false,
  auditCreation: false,
  results: false,
  analytics: false,
  userDataNudge: false,
  contextDocNudge: false,
};

const DEFAULT_BRIDGES: BridgeState = {
  after_dashboard: null,
  after_project_created: null,
  after_project_view: null,
  after_results: null,
};

// Bridge keys are stored in the same JSONB with a "b:" prefix to avoid collisions
const BRIDGE_PREFIX = "b:";
const toBridgeKey = (name: BridgeName) => `${BRIDGE_PREFIX}${name}`;

// Each bridge only appears after its prerequisite tour has completed
const BRIDGE_PREREQUISITES: Record<BridgeName, TourName> = {
  after_dashboard: "dashboard",
  after_project_created: "projectCreated",
  after_project_view: "projectView",
  after_results: "results",
};

const STORAGE_KEY_PREFIX = "qualia_tutorial_completed";
const getStorageKey = (userId: string) => `${STORAGE_KEY_PREFIX}_${userId}`;

const readLocalStorage = (userId: string): TourState => {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) return { ...DEFAULT_STATE, ...JSON.parse(stored) };
  } catch {
    // intentional: localStorage unavailable or stored JSON corrupt — fall back to defaults
  }
  return { ...DEFAULT_STATE };
};

const readBridgesFromLocalStorage = (userId: string): BridgeState => {
  try {
    const stored = localStorage.getItem(`${getStorageKey(userId)}_bridges`);
    if (stored) return { ...DEFAULT_BRIDGES, ...JSON.parse(stored) };
  } catch {
    // intentional: localStorage unavailable or stored JSON corrupt — fall back to defaults
  }
  return { ...DEFAULT_BRIDGES };
};

interface TourStateContextType {
  shouldShowTour: (name: TourName) => boolean;
  markTourCompleted: (name: TourName) => void;
  markTourEnded: (name: TourName) => void;
  resetAllTours: () => void;
  shouldShowBridge: (name: BridgeName) => boolean;
  markBridgeCompleted: (name: BridgeName) => void;
  markBridgeDismissed: (name: BridgeName) => void;
}

const TourStateContext = createContext<TourStateContextType | undefined>(undefined);

export const TourStateProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tours, setTours] = useState<TourState>(DEFAULT_STATE);
  const [bridges, setBridges] = useState<BridgeState>(DEFAULT_BRIDGES);
  // tourEnded tracks whether a tour has *finished* (not just started).
  // Initialized from persisted tour state so bridges survive page refreshes.
  // Only updated in-memory during a session (no separate persistence needed).
  const [tourEnded, setTourEnded] = useState<TourState>(DEFAULT_STATE);
  // isHydrated flips true only after the DB fetch resolves. Tours/bridges are
  // suppressed until then to prevent showing a tour the user already completed
  // on another device when localStorage is empty/stale.
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setTours(DEFAULT_STATE);
      setBridges(DEFAULT_BRIDGES);
      setTourEnded(DEFAULT_STATE);
      setIsHydrated(false);
      return;
    }

    setIsHydrated(false);

    // 1. Apply localStorage immediately so tours don't flash on same browser
    const local = readLocalStorage(user.id);
    setTours(local);
    setTourEnded(local); // initialize tourEnded from persisted state
    setBridges(readBridgesFromLocalStorage(user.id));

    // 2. Fetch DB state and merge (DB is source of truth for cross-device sync)
    getTourState(user.id).then((rawDbState) => {
        const dbState: Record<string, unknown> = rawDbState ?? {};

        // Merge tour state
        setTours((prev) => {
          const merged = { ...prev };
          for (const key of Object.keys(DEFAULT_STATE) as TourName[]) {
            if (dbState[key]) merged[key] = true;
          }
          localStorage.setItem(getStorageKey(user.id), JSON.stringify(merged));
          setTourEnded(merged); // keep tourEnded in sync with persisted tours
          return merged;
        });

        // Merge bridge state
        setBridges((prev) => {
          const merged = { ...prev };
          for (const name of Object.keys(DEFAULT_BRIDGES) as BridgeName[]) {
            const val = dbState[toBridgeKey(name)];
            if (val === "completed" || val === "dismissed") merged[name] = val;
          }
          localStorage.setItem(
            `${getStorageKey(user.id)}_bridges`,
            JSON.stringify(merged)
          );
          return merged;
        });

        setIsHydrated(true);
      });
  }, [user?.id]);

  const persistBridgeToDb = useCallback(
    async (updatedBridges: BridgeState) => {
      if (!user?.id) return;
      // Build the full completed_tours object with bridge keys merged in
      const dbPayload: Record<string, unknown> = {};
      for (const name of Object.keys(updatedBridges) as BridgeName[]) {
        if (updatedBridges[name]) dbPayload[toBridgeKey(name)] = updatedBridges[name];
      }
      await upsertTourState(user.id, dbPayload);
    },
    [user?.id]
  );

  const markTourCompleted = useCallback(
    (name: TourName) => {
      if (!user?.id) return;
      const userId = user.id;
      setTours((prev) => {
        const next = { ...prev, [name]: true };
        localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
        // Read-then-merge so we don't wipe bridge keys (b:*) or other tour
        // flags that may exist in the DB but not in our (possibly stale) state.
        // Awaited via async IIFE so the request actually fires — a bare
        // PostgrestBuilder chain is a thenable and never sends until .then().
        void upsertTourState(userId, next);
        return next;
      });
    },
    [user?.id]
  );

  const markBridgeCompleted = useCallback(
    (name: BridgeName) => {
      if (!user?.id) return;
      setBridges((prev) => {
        const next = { ...prev, [name]: "completed" as BridgeStatus };
        localStorage.setItem(
          `${getStorageKey(user.id)}_bridges`,
          JSON.stringify(next)
        );
        void persistBridgeToDb(next);
        return next;
      });
    },
    [user?.id, persistBridgeToDb]
  );

  const markBridgeDismissed = useCallback(
    (name: BridgeName) => {
      if (!user?.id) return;
      setBridges((prev) => {
        const next = { ...prev, [name]: "dismissed" as BridgeStatus };
        localStorage.setItem(
          `${getStorageKey(user.id)}_bridges`,
          JSON.stringify(next)
        );
        void persistBridgeToDb(next);
        return next;
      });
    },
    [user?.id, persistBridgeToDb]
  );

  const markTourEnded = useCallback((name: TourName) => {
    setTourEnded((prev) => ({ ...prev, [name]: true }));
  }, []);

  const resetAllTours = useCallback(() => {
    if (!user?.id) return;
    const userId = user.id;
    setTours(DEFAULT_STATE);
    setBridges(DEFAULT_BRIDGES);
    setTourEnded(DEFAULT_STATE);
    localStorage.removeItem(getStorageKey(userId));
    localStorage.removeItem(`${getStorageKey(userId)}_bridges`);
    void supabase
      .from("profiles")
      .update({ completed_tours: {} })
      .eq("user_id", userId)
      .then(() => {});
  }, [user?.id]);

  const shouldShowTour = useCallback(
    (name: TourName) => isHydrated && !tours[name],
    [isHydrated, tours]
  );

  const shouldShowBridge = useCallback(
    (name: BridgeName) =>
      isHydrated &&
      bridges[name] === null &&
      tourEnded[BRIDGE_PREREQUISITES[name]],
    [isHydrated, bridges, tourEnded]
  );

  return (
    <TourStateContext.Provider
      value={{
        shouldShowTour,
        markTourCompleted,
        markTourEnded,
        resetAllTours,
        shouldShowBridge,
        markBridgeCompleted,
        markBridgeDismissed,
      }}
    >
      {children}
    </TourStateContext.Provider>
  );
};

export const useTourState = () => {
  const ctx = useContext(TourStateContext);
  if (!ctx) throw new Error("useTourState must be used within TourStateProvider");
  return ctx;
};
