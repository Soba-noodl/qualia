/**
 * Builds a fake report for demo/testing the plugin UI and canvas markers
 * without calling the plugin-analyze API. Uses real node IDs from the
 * current selection so "Highlight all" and "Focus issue" work on the canvas.
 */

import type { Store } from "./store";

type DemoReport = NonNullable<Store["report"]> & { isDemo: true };

/** box_2d [ymin, xmin, ymax, xmax] in 0–1000; spread so markers are visible on frame */
const DEMO_BOXES: [number, number, number, number][] = [
  [120, 120, 280, 280],
  [380, 120, 540, 280],
  [120, 380, 280, 540],
  [380, 380, 540, 540],
  [120, 620, 260, 760],
  [400, 620, 540, 760],
  [620, 120, 760, 260],
  [620, 400, 760, 540],
];

const DEMO_ISSUES: Array<{ issue: string; why_it_matters: string; suggestion?: string; principle?: string }> = [
  { issue: "Demo: Primary action could be more prominent", why_it_matters: "Users may miss the main CTA.", suggestion: "Increase contrast or size.", principle: "Visibility" },
  { issue: "Demo: Label and value are easy to confuse", why_it_matters: "Accessibility and clarity.", suggestion: "Use clear typography hierarchy.", principle: "Consistency" },
  { issue: "Demo: Feedback on submit is delayed", why_it_matters: "Users may double-click.", suggestion: "Show loading state immediately.", principle: "Feedback" },
  { issue: "Demo: Hierarchy of the section is flat", why_it_matters: "Scanning is harder.", suggestion: "Add visual grouping.", principle: "Structure" },
  { issue: "Demo: Error state not clearly distinguished", why_it_matters: "Users may not notice validation errors.", suggestion: "Use color and icon.", principle: "Error prevention" },
  { issue: "Demo: Too many options at once", why_it_matters: "Cognitive load.", suggestion: "Progressive disclosure.", principle: "Recognition" },
  { issue: "Demo: Inconsistent spacing between elements", why_it_matters: "Looks unpolished.", suggestion: "Use a 8px grid.", principle: "Consistency" },
  { issue: "Demo: Icon meaning may be unclear", why_it_matters: "International users.", suggestion: "Add tooltip or label.", principle: "Flexibility" },
];

export function buildDemoReport(nodes: Array<{ id: string; name: string }>): DemoReport {
  const nodeCount = nodes.length;
  const engines: Record<string, unknown[]> = {
    system_logic: [],
    heuristic: [],
    cognitive: [],
    interaction: [],
  };

  let issueIdx = 0;
  for (const engineId of Object.keys(engines)) {
    const list: unknown[] = [];
    for (let i = 0; i < 2; i++) {
      const box = DEMO_BOXES[issueIdx % DEMO_BOXES.length];
      const copy = DEMO_ISSUES[issueIdx % DEMO_ISSUES.length];
      list.push({
        ...copy,
        box_2d: box,
        image_index: nodeCount > 1 ? issueIdx % nodeCount : 0,
      });
      issueIdx++;
    }
    engines[engineId] = list;
  }

  return {
    isDemo: true,
    auditId: `demo-${Date.now()}`,
    score: 72,
    one_big_thing: "Demo report: test markers and highlights without calling the API.",
    sub_scores: {
      system_logic_score: 75,
      heuristic_score: 70,
      cognitive_score: 68,
      interaction_score: 74,
    },
    engines,
    qualia_url: "#",
    flow_analysis: undefined,
    previous_engines: undefined,
  };
}
