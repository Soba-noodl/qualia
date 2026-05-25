import React from "react";
import { IssueCard } from "./IssueCard";

type Stance = "agree" | "disagree" | "already_fixed" | "not_relevant";

type ContrastFailure = {
  element?: string;
  element_description?: string;
  ratio: number;
  required?: number;
  box_2d: [number, number, number, number] | null;
};

type OtherViolation = {
  issue: string;
  wcag_criterion: string;
  severity: "critical" | "warning";
  suggestion: string;
  box_2d: [number, number, number, number] | null;
  image_index?: number | null;
};

type Props = {
  item: ContrastFailure | OtherViolation;
  wcagLevel: string;
  stance: Stance | null;
  reason: string;
  onStanceChange: (stance: Stance | null) => void;
  onReasonChange: (reason: string) => void;
  onReasonBlur: (reason: string) => void;
  onFocus?: () => void;
};

function isContrastFailure(item: ContrastFailure | OtherViolation): item is ContrastFailure {
  return "ratio" in item;
}

export function AccessibilityIssueCard({
  item, wcagLevel, stance, reason, onStanceChange, onReasonChange, onReasonBlur, onFocus,
}: Props) {
  if (isContrastFailure(item)) {
    const elementLabel = item.element ?? item.element_description ?? "Element";
    const required = item.required ?? 4.5;
    return (
      <IssueCard
        text={`${elementLabel}: ratio ${item.ratio.toFixed(1)} (requires ${required})`}
        whyItMatters="Text with insufficient contrast is unreadable for users with low vision or in bright environments."
        suggestion={`Increase the foreground/background contrast ratio to at least ${required}:1 to meet WCAG ${wcagLevel}.`}
        severity="high"
        stance={stance}
        reason={reason}
        onStanceChange={onStanceChange}
        onReasonChange={onReasonChange}
        onReasonBlur={onReasonBlur}
        onClick={item.box_2d ? onFocus : undefined}
      />
    );
  }

  return (
    <IssueCard
      text={item.issue}
      whyItMatters={`Violates WCAG ${item.wcag_criterion}`}
      suggestion={item.suggestion}
      severity={item.severity === "critical" ? "high" : "medium"}
      stance={stance}
      reason={reason}
      onStanceChange={onStanceChange}
      onReasonChange={onReasonChange}
      onReasonBlur={onReasonBlur}
      onClick={item.box_2d ? onFocus : undefined}
    />
  );
}
