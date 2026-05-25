/**
 * Shared types and constants for Synthetic User Analysis.
 * All synth-related files (form, report, Edge Function) derive from these.
 */

export type SynthVerdict = "PASS" | "FRICTION" | "BLOCKER";
export type SynthEmotion = "Satisfied" | "Confused" | "Frustrated" | "Anxious";
export type SynthNextAction = "CLICK" | "TYPE" | "ABANDON";

export interface SynthUserResult {
  persona_id: string;
  persona_name: string;
  verdict: SynthVerdict;
  emotion: SynthEmotion;
  diary_entry: string;
  missing_affordance: string;
  next_action: SynthNextAction;
  reasoning: string;
  zone_detected?: string;
  persona_reaction?: string;
  current_goal?: string;
  primary_focus?: string;
  target_element?: string;
}

export interface SynthUsersBlock {
  critical_finding: string;
  shared_friction: string[];
  results: SynthUserResult[];
}

export interface SynthArchetype {
  id: string;
  name: string;
  roleLabel: string;
  shortQuote: string;
  description: string;
}

export const SYNTH_ARCHETYPES: SynthArchetype[] = [
  {
    id: "power_user",
    name: "Power User",
    roleLabel: "Developer / Senior Analyst",
    shortQuote: "Don't treat me like a beginner. I want shortcuts, raw data, and speed.",
    description: "Scans for keyboard shortcuts, dense toolbars, and raw data access. Reacts negatively to wizards and oversimplified UIs.",
  },
  {
    id: "spreadsheet_veteran",
    name: "Spreadsheet Veteran",
    roleLabel: "Operations Manager / Data Entry",
    shortQuote: "Whitespace is my enemy. If I can't see 20 rows at once, this tool is a toy.",
    description: "Needs high data density and direct edit-in-place. Frustrated by carousels, cards, and anything that hides rows behind clicks.",
  },
  {
    id: "admin_gatekeeper",
    name: "Admin Gatekeeper",
    roleLabel: "IT Manager / SysAdmin",
    shortQuote: "I don't care if it's pretty. I care if it's safe, compliant, and easy to manage.",
    description: "Looks for permissions, audit logs, and SSO. Blocks adoption if security or compliance controls are invisible or missing.",
  },
  {
    id: "the_boss",
    name: "The Boss",
    roleLabel: "VP / Director",
    shortQuote: "I have 2 minutes. Am I winning or losing? I want the summary, not the details.",
    description: "Needs an instant status signal — a score, a trend, a red/green status. Abandons anything that requires reading to understand.",
  },
  {
    id: "automator",
    name: "Automator",
    roleLabel: "RevOps / Marketing Ops / Solution Architect",
    shortQuote: "Data silos are the enemy. If this data is trapped inside your UI, this tool is useless.",
    description: "Evaluates every screen for API access, webhooks, and export options. A walled garden is an immediate blocker.",
  },
  {
    id: "daily_driver",
    name: "Daily Driver",
    roleLabel: "Account Executive / PM / Content Writer",
    shortQuote: "I'm not a tech person. I just want to finish tasks without feeling stupid.",
    description: "Relies on clear labels, visible next steps, and forgiving error states. Any ambiguity or jargon causes confusion and dropout.",
  },
];

export const MAX_SYNTH_ARCHETYPES = 3;
