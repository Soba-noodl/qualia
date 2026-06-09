/**
 * UX principle taxonomy: tag -> "What It Flags" description.
 * Source: ux_taxonomy.md (controlled vocabulary for tagging findings).
 */
export const UX_TAXONOMY: Record<string, string> = {
  "Hick's Law": "Too many choices slowing down decision-making",
  "Miller's Law": "Working memory overload — more than 4–7 chunks presented at once",
  "Fitts's Law": "Targets too small or too far from the cursor or thumb",
  "Jakob's Law": "Interface deviates from conventions users already know from other products",
  "Tesler's Law": "Complexity not absorbed by the system — pushed onto the user instead",
  "Occam's Razor": "Unnecessary elements adding noise without value",
  "Cognitive Tunneling": "User so focused on one element they miss critical surrounding context",

  "Gestalt: Proximity": "Elements that should feel related are visually grouped poorly",
  "Gestalt: Similarity": "Visually similar elements are being confused for each other",
  "Gestalt: Figure/Ground": "Foreground and background aren't sufficiently distinct",
  "Gestalt: Continuity": "Visual flow is interrupted or hard to follow",
  "Visual Hierarchy": "Nothing clearly dominant — the eye doesn't know where to land",
  "Signal-to-Noise": "Too much competing for attention; key action is buried",
  "Pre-attentive Processing": "Failing to use color, size, or motion to guide attention before conscious effort",
  "F-Pattern / Z-Pattern": "Content placement contradicts natural eye-scanning behavior",

  "Feedback Loop": "Action has no visible system response",
  "Error Prevention": "Design allows or invites easily made mistakes",
  "Error Recovery": "Error message doesn't explain what went wrong or how to fix it",
  "State Completeness": "Missing hover, loading, error, empty, or disabled state",
  "Affordance": "Element doesn't look like it does what it does",
  "False Affordance": "Element appears interactive but isn't — click rage potential",
  "Confirmation Trap": "Irreversible action lacks appropriate confirmation or undo option",
  "Feedback Latency": "System response is too slow without communicating progress",

  "Wayfinding": "User can't tell where they are in the product",
  "Information Scent": "Link or button doesn't clearly signal what's behind it",
  "Dead End": "No clear path forward or backward from the current state",
  "Escape Route": "User is trapped — no way to cancel, go back, or exit the flow",
  "Spatial Memory": "Navigation position changes unexpectedly across screens",
  "Breadcrumb Gap": "Multi-step flow with no progress indication",

  "Loss Aversion": "Missed opportunity to use \"don't lose X\" framing instead of \"save X\"",
  "Default Bias": "Default option is not the best or safest choice for most users",
  "Anchoring": "First option or price sets a misleading or unconvincing reference point",
  "Choice Paralysis": "Too many equivalent options causing decision freeze",
  "Commitment Escalation": "Flow asks for high commitment too early — e.g. credit card before value is shown",
  "Peak-End Rule": "Peak moment or final step of the flow is weak, degrading overall perception",
  "Emotional Friction": "Tone is wrong for the user's emotional state at this moment",
  "Trust Signal Gap": "Anxiety-inducing action has no reassurance, social proof, or trust cue nearby",
  "Reactance": "UI feels controlling or pushy — user will resist or abandon",

  "Nielsen #1: System Status": "No feedback about what the system is doing",
  "Nielsen #2: Real World Match": "Language or concepts don't match the user's mental model",
  "Nielsen #3: User Control": "No undo, redo, or clear exit available",
  "Nielsen #4: Consistency": "Same action looks or behaves differently across the UI",
  "Nielsen #5: Error Prevention": "Design doesn't prevent predictable mistakes at input or action level",
  "Nielsen #6: Recognition over Recall": "User must remember information instead of seeing it presented",
  "Nielsen #7: Flexibility": "No shortcuts or acceleration paths for expert users",
  "Nielsen #8: Aesthetic Minimalism": "Irrelevant or rarely needed content competes with primary information",
  "Nielsen #9: Error Recovery": "Errors not expressed in plain language with a clear solution",
  "Nielsen #10: Help & Documentation": "No support available for users who are stuck",

  // Aliases: model may return "Nielsen Heuristic N" or "Nielsen N: ..." instead of "Nielsen #N: ..."
  "Nielsen Heuristic 1": "No feedback about what the system is doing",
  "Nielsen Heuristic 2": "Language or concepts don't match the user's mental model",
  "Nielsen Heuristic 3": "No undo, redo, or clear exit available",
  "Nielsen Heuristic 4": "Same action looks or behaves differently across the UI",
  "Nielsen Heuristic 5": "Design doesn't prevent predictable mistakes at input or action level",
  "Nielsen Heuristic 6": "User must remember information instead of seeing it presented",
  "Nielsen Heuristic 7": "No shortcuts or acceleration paths for expert users",
  "Nielsen Heuristic 8": "Irrelevant or rarely needed content competes with primary information",
  "Nielsen Heuristic 9": "Errors not expressed in plain language with a clear solution",
  "Nielsen Heuristic 10": "No support available for users who are stuck",
  "Nielsen 6: Recognition over Recall": "User must remember information instead of seeing it presented",
  "Nielsen #6:Recognition over Recall": "User must remember information instead of seeing it presented",
};

/** Returns the taxonomy description for a principle tag, or undefined if not found. */
export function getPrincipleDescription(tag: string): string | undefined {
  const trimmed = tag.trim();
  return UX_TAXONOMY[trimmed];
}
