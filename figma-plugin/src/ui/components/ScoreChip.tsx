import React from "react";

type Props = { label: string; score: number };

export function ScoreChip({ label, score }: Props) {
  return (
    <span style={styles.chip}>
      <span style={styles.label}>{label}</span>
      <span style={styles.score}>{score}</span>
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  chip: { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, background: "#f0f0f0", fontSize: 11 },
  label: { color: "#666" },
  score: { fontWeight: 600 },
};
