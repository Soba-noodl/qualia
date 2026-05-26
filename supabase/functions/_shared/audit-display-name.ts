type Input = {
  figma_frame_names: string[] | null | undefined;
  screen_context: string | null | undefined;
  ai_report: Record<string, unknown> | null | undefined;
};

const MAX_CONTEXT_CHARS = 40;

export function auditDisplayName(input: Input): string {
  const frames = (input.figma_frame_names ?? []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );

  if (frames.length === 1) return frames[0];
  if (frames.length === 2) return `${frames[0]} · ${frames[1]}`;
  if (frames.length > 2) return `${frames[0]} · ${frames[1]} + ${frames.length - 2} more`;

  const protoMeta = input.ai_report && typeof input.ai_report === "object"
    ? (input.ai_report as Record<string, unknown>).prototype_meta
    : undefined;
  const protoName = protoMeta && typeof protoMeta === "object"
    ? (protoMeta as Record<string, unknown>).figma_file_name
    : undefined;
  if (typeof protoName === "string" && protoName.trim().length > 0) {
    return protoName.trim();
  }

  const ctx = (input.screen_context ?? "").trim();
  if (ctx.length > 0) {
    return ctx.length > MAX_CONTEXT_CHARS ? `${ctx.slice(0, MAX_CONTEXT_CHARS)}…` : ctx;
  }

  return "Untitled audit";
}
