import { useCallback, useRef } from "react";
import type { Driver, Config, DriveStep } from "driver.js";
import { useTourState } from "@/contexts/TourStateContext";

// Common driver config
const getBaseConfig = (): Partial<Config> => ({
  showProgress: true,
  animate: true,
  allowClose: true,
  overlayOpacity: 0.7,
  stagePadding: 8,
  stageRadius: 8,
  popoverClass: "qualia-tour-popover",
  progressText: "{{current}} / {{total}}",
  nextBtnText: "Next →",
  prevBtnText: "← Back",
  doneBtnText: "Got it!",
});

// Dashboard Tour Steps
export const useDashboardTour = () => {
  const { shouldShowTour, markTourCompleted, markTourEnded } = useTourState();
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(async () => {
    if (!shouldShowTour("dashboard")) return;

    markTourCompleted("dashboard");

    const [{ driver }] = await Promise.all([
      import("driver.js"),
      import("driver.js/dist/driver.css"),
    ]);

    setTimeout(() => {
      const steps: DriveStep[] = [
        {
          popover: {
            title: "Welcome to Qualia",
            description: "Your AI Auditor is ready. Let's analyze your UI for conversion blockers and logic errors.",
            align: "center",
          },
        },
        {
          element: '[data-tour="create-project"]',
          popover: {
            title: "Create Your First Project",
            description: "Start here. Give your project a name and scope, then define the Mission and User Archetypes — the AI will use these to critique every screen with your specific context in mind.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="statistics"]',
          popover: {
            title: "Track Your Progress",
            description: "Track how your design scores improve over time across different projects.",
            side: "bottom",
            align: "end",
          },
        },
      ];

      driverRef.current = driver({
        ...getBaseConfig(),
        steps,
        onDestroyed: () => {
          markTourEnded("dashboard");
        },
      });

      driverRef.current.drive();
    }, 500);
  }, [shouldShowTour, markTourCompleted, markTourEnded]);

  const destroyTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { startTour, destroyTour };
};

// Project Created Tour - triggers after user creates their first project
export const useProjectCreatedTour = () => {
  const { shouldShowTour, markTourCompleted, markTourEnded } = useTourState();
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(async () => {
    if (!shouldShowTour("projectCreated")) return;

    markTourCompleted("projectCreated");

    const [{ driver }] = await Promise.all([
      import("driver.js"),
      import("driver.js/dist/driver.css"),
    ]);

    setTimeout(() => {
      const steps: DriveStep[] = [
        {
          element: '[data-tour="project-card"]',
          popover: {
            title: "Your Project is Ready!",
            description: "Here's your new project. Click to open it and start your first UI audit.",
            side: "bottom",
            align: "start",
          },
        },
      ];

      driverRef.current = driver({
        ...getBaseConfig(),
        steps,
        onDestroyed: () => {
          markTourEnded("projectCreated");
        },
      });

      driverRef.current.drive();
    }, 600);
  }, [shouldShowTour, markTourCompleted, markTourEnded]);

  const destroyTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { startTour, destroyTour };
};

// Project View Tour Steps
export const useProjectViewTour = () => {
  const { shouldShowTour, markTourCompleted, markTourEnded } = useTourState();
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(async () => {
    if (!shouldShowTour("projectView")) return;

    markTourCompleted("projectView");

    const [{ driver }] = await Promise.all([
      import("driver.js"),
      import("driver.js/dist/driver.css"),
    ]);

    setTimeout(() => {
      const steps: DriveStep[] = [
        {
          element: '[data-tour="project-context-card"]',
          popover: {
            title: "Project Memory",
            description: "The Mission and Archetypes you just defined are saved here. They will be automatically applied to every future audit in this project.",
            side: "right",
            align: "start",
          },
        },
        {
          element: '[data-tour="new-audit-button"]',
          popover: {
            title: "Start Analysis",
            description: "Ready to test? Click here to upload your first screenshot or paste a Figma link.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="audits-list"]',
          popover: {
            title: "Your Past Audits",
            description: "This is where you'll see all your past audits. Each analysis is saved here for future reference.",
            side: "top",
            align: "center",
          },
        },
      ];

      driverRef.current = driver({
        ...getBaseConfig(),
        steps,
        onDestroyed: () => {
          markTourEnded("projectView");
        },
      });

      driverRef.current.drive();
    }, 600);
  }, [shouldShowTour, markTourCompleted, markTourEnded]);

  const destroyTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { startTour, destroyTour };
};

// Audit Creation Tour Steps
export const useAuditCreationTour = () => {
  const { shouldShowTour, markTourCompleted } = useTourState();
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(async () => {
    if (!shouldShowTour("auditCreation")) return;

    markTourCompleted("auditCreation");

    const [{ driver }] = await Promise.all([
      import("driver.js"),
      import("driver.js/dist/driver.css"),
    ]);

    setTimeout(() => {
      const steps: DriveStep[] = [
        {
          element: '[data-tour="audit-type-tabs"]',
          popover: {
            title: "Choose Your Analysis Type",
            description: "Choose Single Screen for deep dives or Flow for user journeys.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="upload-area"]',
          popover: {
            title: "Upload Your Design",
            description: "Upload screenshots or paste a Figma link. This works for both single screens and multi-step flows.",
            side: "top",
            align: "center",
          },
        },
        {
          element: '[data-tour="goal-input"]',
          popover: {
            title: "Define the User Goal",
            description: "Crucial: Tell the AI what the user is trying to do here.",
            side: "top",
            align: "center",
          },
        },
      ];

      driverRef.current = driver({
        ...getBaseConfig(),
        steps,
        onDestroyed: () => {
          markTourCompleted("auditCreation");
        },
      });

      driverRef.current.drive();
    }, 600);
  }, [shouldShowTour, markTourCompleted]);

  const destroyTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { startTour, destroyTour };
};

// Results Page Tour Steps
export const useResultsTour = () => {
  const { shouldShowTour, markTourCompleted, markTourEnded } = useTourState();
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(async () => {
    if (!shouldShowTour("results")) return;

    markTourCompleted("results");

    const [{ driver }] = await Promise.all([
      import("driver.js"),
      import("driver.js/dist/driver.css"),
    ]);

    setTimeout(() => {
      const steps: DriveStep[] = [
        {
          element: '[data-tour="analyzed-image"]',
          popover: {
            title: "Your Analyzed Design",
            description: "The AI has analyzed your design. The colored pins indicate specific friction points or heuristic violations.",
            side: "right",
            align: "start",
          },
        },
        {
          element: '[data-tour="feedback-sidebar"]',
          popover: {
            title: "Strategic Feedback",
            description: "Click any Pin to read the strategic analysis. It's not just a generic critique; it's grounded in the Persona you defined.",
            side: "left",
            align: "start",
          },
        },
        {
          element: '[data-tour="issue-feedback"]',
          popover: {
            title: "Calibrate Your Re-audit",
            description: "For each issue you can say if you agree, disagree, already fixed it, or it's not relevant — and add a short reason. This feedback is used as context when you run a re-audit, so the AI can focus on what matters to you.",
            side: "left",
            align: "start",
          },
        },
        {
          element: '[data-tour="reaudit-button"]',
          popover: {
            title: "Re-audit",
            description: "You can re-audit in two ways: upload a new mockup to see score changes and get a comparison, or run a feedback-only re-audit using your per-issue replies — no new screenshot needed.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: '[data-tour="feedback-card"]',
          popover: {
            title: "Rate This Audit",
            description: "Your feedback helps Qualia improve. Rate the usefulness and leave an optional comment.",
            side: "top",
            align: "center",
          },
        },
      ];

      driverRef.current = driver({
        ...getBaseConfig(),
        steps,
        onDestroyed: () => {
          markTourEnded("results");
        },
      });

      driverRef.current.drive();
    }, 800);
  }, [shouldShowTour, markTourCompleted, markTourEnded]);

  const destroyTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { startTour, destroyTour };
};

// Analytics Page Tour Steps
export const useAnalyticsTour = () => {
  const { shouldShowTour, markTourCompleted } = useTourState();
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(async () => {
    if (!shouldShowTour("analytics")) return;

    markTourCompleted("analytics");

    const [{ driver }] = await Promise.all([
      import("driver.js"),
      import("driver.js/dist/driver.css"),
    ]);

    setTimeout(() => {
      const steps: DriveStep[] = [
        {
          element: '[data-tour="analytics-big-numbers"]',
          popover: {
            title: "Key metrics at a glance",
            description: "Projects, total audits, useful audits, and re-audits. These numbers update with your selected date range.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="analytics-charts"]',
          popover: {
            title: "Activity & Usefulness Charts",
            description: "These graphs show your audit volume over time and how many were rated useful. Use the date filter to zoom into specific periods.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="analytics-score-by-project"]',
          popover: {
            title: "Score by Project",
            description: "Compare average scores across projects. Scores are only comparable within the same project — use this to track improvement over time.",
            side: "top",
            align: "center",
          },
        },
        {
          element: '[data-tour="analytics-recent-audits"]',
          popover: {
            title: "Recent Audits",
            description: "A quick overview of your latest audits with scores and usefulness ratings at a glance.",
            side: "top",
            align: "center",
          },
        },
      ];

      driverRef.current = driver({
        ...getBaseConfig(),
        steps,
        onDestroyed: () => {
          markTourCompleted("analytics");
        },
      });

      driverRef.current.drive();
    }, 600);
  }, [shouldShowTour, markTourCompleted]);

  const destroyTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { startTour, destroyTour };
};
