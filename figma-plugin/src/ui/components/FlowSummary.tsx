import React from "react";

type FlowTransition = { from: number; to: number; status?: string; note?: string };
type FlowFrictionPoint = { step?: number; description?: string };
type FlowMissingStep = string | { after_step?: number; what_is_missing?: string };

type FlowAnalysis = {
  step_transitions?: Array<FlowTransition>;
  friction_points?: Array<FlowFrictionPoint>;
  missing_steps?: Array<FlowMissingStep>;
};

type Props = { flow_analysis: FlowAnalysis | null | undefined };

function getFlowContent(flow_analysis: FlowAnalysis | null | undefined) {
  const transitions: FlowTransition[] = (flow_analysis?.step_transitions ?? []).filter((t) => {
    const hasSteps = typeof t.from === "number" && typeof t.to === "number";
    const status = (t.status ?? "").toLowerCase();
    const hasInterestingStatus = status !== "" && status !== "ok";
    const hasNote = typeof t.note === "string" && t.note.trim().length > 0;
    return hasSteps && (hasInterestingStatus || hasNote);
  });
  const friction: FlowFrictionPoint[] = (flow_analysis?.friction_points ?? []).filter((f) => {
    const hasDescription = typeof f.description === "string" && f.description.trim().length > 0;
    return hasDescription;
  });
  const missing: FlowMissingStep[] = (flow_analysis?.missing_steps ?? []).filter((m) => {
    if (typeof m === "string") return m.trim().length > 0;
    const text = (m as { what_is_missing?: string }).what_is_missing ?? "";
    return text.trim().length > 0;
  });
  const hasContent = transitions.length > 0 || friction.length > 0 || missing.length > 0;
  return { transitions, friction, missing, hasContent };
}

/** True when the Flow block has something to show (flow_analysis with transitions, friction, or missing steps). */
export function hasFlowContent(flow_analysis: FlowAnalysis | null | undefined): boolean {
  return !!flow_analysis && getFlowContent(flow_analysis).hasContent;
}

export function FlowSummary({ flow_analysis }: Props) {
  const { transitions, friction, missing, hasContent } = getFlowContent(flow_analysis);

  return (
    <div className="bg-surface-1 border border-border rounded-xl p-3.5">
      <h3 className="m-0 mb-2 text-[14px] font-semibold text-foreground">Flow</h3>
      <p className="m-0 mb-3 text-[13px] text-foreground/65 leading-snug">
        High-level notes about how the steps in this flow connect, where people get stuck, and which screens might be missing.
      </p>
      {transitions.length > 0 && (
        <div className="mb-3">
          <strong className="text-[12px] font-semibold text-foreground/65">Step transitions</strong>
          <ul className="mt-1 mb-0 pl-[18px]">
            {transitions.map((t, i) => (
              <li key={i} className="mb-1 text-[12px] leading-snug text-foreground">
                Step {t.from} → {t.to}: {t.status ?? "ok"} {t.note && `— ${t.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {friction.length > 0 && (
        <div className="mb-3">
          <strong className="text-[12px] font-semibold text-foreground/65">Friction points by step</strong>
          <ul className="mt-1 mb-0 pl-[18px]">
            {friction.map((f, i) => (
              <li key={i} className="mb-1 text-[12px] leading-snug text-foreground">
                {f.step != null ? `Step ${f.step}: ` : ""}{f.description ?? ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {missing.length > 0 && (
        <div className="mb-3">
          <strong className="text-[12px] font-semibold text-foreground/65">Missing or implied steps</strong>
          <ul className="mt-1 mb-0 pl-[18px]">
            {missing.map((m, i) => (
              <li key={i} className="mb-1 text-[12px] leading-snug text-foreground">
                {typeof m === "string"
                  ? m
                  : `${m.after_step != null ? `After step ${m.after_step}: ` : ""}${m.what_is_missing ?? ""}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
