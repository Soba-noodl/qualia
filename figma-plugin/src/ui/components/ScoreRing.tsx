import React from "react";

type Props = { score: number; size?: number; label?: string };

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function ScoreRing({ score, size = 54, label }: Props) {
  const r = (size / 2) - 5;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1e2e" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${circumference}`} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x={size/2} y={size/2 + 5} textAnchor="middle"
          fontFamily="Inter,sans-serif" fontSize="13" fontWeight="700" fill={color}>
          {score}
        </text>
      </svg>
      {label && <span className="text-[11px] text-foreground/65">{label}</span>}
    </div>
  );
}
