#!/usr/bin/env node
// build-ux-prompts-repo.mjs — one-time generator for the public
// Soba-noodl/qualia-ux-prompts repo.
//
// Extracts Qualia's audit prompts VERBATIM from the private codebase
// (no transcription), wraps each in an annotated Markdown file, bundles
// two self-contained Claude skills (q-visual-audit for the image prompts,
// q-code-audit for the six code engines), and writes a self-contained repo
// to OUT_DIR. Static snapshot — Qualia is wound down, so the prompts are
// frozen; this is not a live sync.
//
// Usage:  node scripts/build-ux-prompts-repo.mjs [OUT_DIR]
//         (default OUT_DIR=/tmp/qualia-ux-prompts)

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const OUT = process.argv[2] || "/tmp/qualia-ux-prompts";
const MIRROR = "https://github.com/Soba-noodl/qualia/blob/main"; // app mirror

// ── verbatim extraction ──────────────────────────────────────────────────
// Prompts are plain template literals with {token} placeholders (no JS
// interpolation). Slice between `export const NAME = \`` and the closing
// `\`;` (non-greedy). Prompt bodies are prose and never contain `\`;`.
function extract(srcPath, name) {
  const src = readFileSync(join(ROOT, srcPath), "utf8");
  const re = new RegExp("export const " + name + "\\s*=\\s*`([\\s\\S]*?)`;", "m");
  const m = src.match(re);
  if (!m) throw new Error(`could not extract ${name} from ${srcPath}`);
  return m[1].trim();
}

const tokens = (body) =>
  [...new Set((body.match(/\{[a-zA-Z_]+\}/g) || []))].sort();

// ── token glossary (shared across image-based prompts) ─────────────────────
const GLOSS = {
  "{project_mission}": "the product's mission / what it's for",
  "{project_persona}": "the target user persona the audit is scored against",
  "{project_language}": "language the findings should be written in",
  "{project_constraints}": "known constraints (platform, brand, tech)",
  "{screen_context}": "caller-supplied description of the screen under audit",
  "{user_data_block}": "any real user/usage data to ground the review",
  "{additional_context_block}": "free-form extra context appended by the caller",
  "{node_map_block}": "Figma layer-ID map (see node-map anchoring fragment)",
  "{contrast_data}": "measured WCAG contrast ratios for the screen",
  "{design_token_summary}": "extracted design-token / style summary",
  "{previous_audit_feedback}": "prior audit + user feedback, for re-audits",
  "{step_count}": "number of screenshots in the session",
  "{crawl_url}": "the URL that was auto-crawled",
  "{frame_map}": "ordered map of prototype frames",
  "{figma_file_name}": "source Figma file name",
  "{connection_note}": "note on how prototype frames are connected",
  "{persona_profile}": "the synthetic persona's profile",
  "{project_context}": "the product context the synthetic user reacts to",
  "{framework}": "the route's tech stack (e.g. React 18, react-router, shadcn/ui)",
  "{routeContext}": 'the route under audit (e.g. "/dashboard (src/pages/Dashboard.tsx)")',
  "{code}": "concatenated source corpus for the route",
  "{routeFindingsSummary}": "digest of all per-route findings",
  "{componentGraphSummary}": "component-graph summary (classes + primitive imports)",
};

// ── manifest ───────────────────────────────────────────────────────────────
const IMG = "supabase/functions/_shared/analyze-prompts.ts";
const SYNTH = "supabase/functions/_shared/synth-prompts.ts";
const ENG = "scripts/ux-audit/prompts";

// Prompts marked with `skill` are bundled raw (as `skillFile`) inside that
// skill's `prompts/` folder, so the skill is self-contained when copied into
// any project's `.claude/skills/`. Entries with no `skill` are docs-only.
const VISUAL = "q-visual-audit";
const CODE = "q-code-audit";

const PROMPTS = [
  {
    out: "prompts/single-screen.md", skill: VISUAL, skillFile: "single-screen.txt",
    src: IMG, name: "SINGLE_SCREEN_PROMPT",
    title: "Single-screen audit",
    intro:
      "The core Qualia prompt. Reviews one screen (a screenshot or a single " +
      "design) as an \"elite Strategic Product Design Lead\" pairing with a " +
      "senior UI designer, hunting business-critical blockers and conversion " +
      "killers rather than cosmetic nits. Returns scored, falsifiable findings.",
  },
  {
    out: "prompts/user-flow.md", skill: VISUAL, skillFile: "user-flow.txt",
    src: IMG, name: "FLOW_ANALYSIS_PROMPT",
    title: "User-flow audit",
    intro:
      "Audits a multi-step user flow as an ordered sequence of screens. " +
      "Looks for friction, broken transitions, missing states, and " +
      "conversion killers across the whole journey, not just per screen.",
  },
  {
    out: "prompts/auto-crawl.md", skill: VISUAL, skillFile: "auto-crawl.txt",
    src: IMG, name: "AUTO_CRAWL_PROMPT",
    title: "Auto-crawl audit (live product)",
    intro:
      "Audits screenshots captured by automatically navigating a live " +
      "product as a real user (landing → nav → CTAs → modals → detail views, " +
      "in session order). Adds a cross-session layer: transition quality, " +
      "consistency, peak-end, and a design-system coherence pass across all " +
      "captured screens.",
  },
  {
    out: "prompts/figma-prototype.md", skill: VISUAL, skillFile: "figma-prototype.txt",
    src: IMG, name: "FIGMA_PROTOTYPE_CRAWL_PROMPT",
    title: "Figma prototype audit",
    intro:
      "Audits frames exported from a Figma prototype, traversed via the " +
      "prototype's connection graph from entry screens through clickable " +
      "flows. Same rigor as auto-crawl, framed for design-time artifacts.",
  },
  {
    out: "prompts/synthetic-users.md", skill: VISUAL, skillFile: "synthetic-users.txt",
    src: SYNTH, name: "SYNTH_MASTER_PROMPT",
    title: "Synthetic user engine",
    intro:
      "Drives a B2B synthetic user: the model role-plays a specific persona " +
      "reacting to a product, surfacing the friction a real user of that " +
      "profile would hit. Used to pressure-test designs before real testing.",
  },
  {
    out: "prompts/_node-map-anchoring.md",
    src: IMG, name: "NODE_MAP_INSTRUCTIONS",
    title: "Node-map anchoring (shared fragment)",
    intro:
      "Not a standalone prompt — a shared instruction block injected into the " +
      "image prompts when a Figma layer map is available. It anchors each " +
      "localized issue to concrete Figma layer IDs while keeping all " +
      "user-facing text in plain language.",
  },
  // ── code-based 6-engine system (powers the q-code-audit skill) ──
  { out: "engines/c-cognitive-visual.md",   skill: CODE, skillFile: "c.txt",  src: `${ENG}/c.ts`,  name: "C_PROMPT",
    title: "Engine C — Cognitive & Visual",
    intro: "Audits one route from its source code for cognitive load and visual hierarchy." },
  { out: "engines/d-designer-lens.md",       skill: CODE, skillFile: "d.txt",  src: `${ENG}/d.ts`,  name: "D_PROMPT",
    title: "Engine D — Designer Lens",
    intro: "The designer-judgment rubric: evaluates a route the way a senior product designer would." },
  { out: "engines/h-heuristic-navigation.md", skill: CODE, skillFile: "h.txt", src: `${ENG}/h.ts`, name: "H_PROMPT",
    title: "Engine H — Heuristic & Navigation",
    intro: "Classic usability heuristics + navigation/IA evaluation from source." },
  { out: "engines/i-interaction-cost.md",    skill: CODE, skillFile: "i.txt",  src: `${ENG}/i.ts`,  name: "I_PROMPT",
    title: "Engine I — Interaction Cost",
    intro: "Counts the interaction cost (steps, decisions, input effort) a route imposes on the user." },
  { out: "engines/sl-system-logic-flow.md",  skill: CODE, skillFile: "sl.txt", src: `${ENG}/sl.ts`, name: "SL_PROMPT",
    title: "Engine SL — System Logic & Flow",
    intro: "Audits state, feedback, error handling, and flow logic from the route's source." },
  { out: "engines/x-coherence.md",           skill: CODE, skillFile: "x.txt",  src: `${ENG}/x.ts`,  name: "X_PROMPT",
    title: "Engine X — Cross-sectional / Coherence",
    intro: "Runs once across the whole codebase: aggregates per-route findings + a component graph to catch coherence issues with reach > 1." },
];

// ── build ────────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const p of PROMPTS) {
  const body = extract(p.src, p.name);
  const toks = tokens(body);
  const inputs = toks.length
    ? toks.map((t) => `- \`${t}\` — ${GLOSS[t] || "(caller-supplied)"}`).join("\n")
    : "_None — this prompt takes no placeholders._";
  const md =
`# ${p.title}

${p.intro}

**Inputs (placeholders, substituted at call time):**
${inputs}

**Source:** [\`${p.src}\`](${MIRROR}/${p.src})

---

~~~text
${body}
~~~
`;
  const dest = join(OUT, p.out);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, md);
  console.log(`  ${p.out}  (${body.length} chars, ${toks.length} tokens)`);

  // Bundle the raw prompt INSIDE its skill so the skill is self-contained
  // when copied into any project's .claude/skills/ (the skill reads these by
  // relative path; it has no access to the private codebase).
  if (p.skill && p.skillFile) {
    const sdest = join(OUT, "skills", p.skill, "prompts", p.skillFile);
    mkdirSync(dirname(sdest), { recursive: true });
    writeFileSync(sdest, body + "\n");
  }
}

// ── skills ───────────────────────────────────────────────────────────────
// Ship the ADAPTED public SKILL.md for each skill (paths point at the
// bundled prompts, Qualia-DB/internal references removed) — NOT the private
// operator skills, which read prompts from the live codebase and would fail
// standalone.
for (const skill of [VISUAL, CODE]) {
  cpSync(join(ROOT, `scripts/oss-assets/${skill}.SKILL.md`),
         join(OUT, "skills", skill, "SKILL.md"));
  console.log(`  skills/${skill}/  (SKILL.md + bundled prompts)`);
}

// ── top-level docs ──────────────────────────────────────────────────────────
cpSync(join(ROOT, "scripts/oss-assets/qualia-ux-prompts.README.md"), join(OUT, "README.md"));
cpSync(join(ROOT, "scripts/oss-assets/LICENSE"), join(OUT, "LICENSE"));
console.log("  README.md + LICENSE");

console.log(`\nBuilt at ${OUT}`);
