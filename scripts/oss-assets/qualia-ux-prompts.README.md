# Qualia UX audit prompts

The production prompts that powered **[Qualia](https://github.com/Soba-noodl/qualia)** — an AI tool for fast, consistent UX & accessibility audits — extracted verbatim and annotated so you can read, learn from, and reuse them.

Qualia was shut down commercially in 2026 and open-sourced. The full application lives at [`Soba-noodl/qualia`](https://github.com/Soba-noodl/qualia); this repo pulls just the prompt engineering out of the codebase, where it was otherwise buried inside 1,000-line TypeScript files.

## The idea

Most "AI design review" is cosmetic nit-picking. Qualia's prompts are built around a different stance: act as an **elite Strategic Product Design Lead** and surface **business-critical blockers and conversion killers**, with findings that are **scored** and **falsifiable** — every verdict must be a specific claim that could be proven wrong. That posture is what these prompts encode.

## Validation

These prompts are not theoretical. Their wording, scoring bands, and finding filters were tuned against real usage:

- **160+ real audits** run by real users
- **43 in-depth user interviews**
- **5 cycles of quantitative research** across **100 users**
- countless hands-on tests by the maker

That body of feedback is what calibrated what you see here.

## What's here

### `prompts/` — image-based audits
The live product audited screenshots and designs. Each file is one production prompt, with its inputs and a link back to source.

| Prompt | Audits |
| --- | --- |
| [`single-screen`](prompts/single-screen.md) | one screen or design (the core prompt) |
| [`user-flow`](prompts/user-flow.md) | a multi-step flow as an ordered sequence |
| [`auto-crawl`](prompts/auto-crawl.md) | screenshots auto-captured from a live product |
| [`figma-prototype`](prompts/figma-prototype.md) | frames traversed from a Figma prototype |
| [`synthetic-users`](prompts/synthetic-users.md) | a role-played persona reacting to a product |
| [`_node-map-anchoring`](prompts/_node-map-anchoring.md) | shared fragment: anchor issues to Figma layer IDs |

### `engines/` — code-based audits
A second system that audits a route's **source code** through six lenses, then aggregates. Packaged as the runnable `q-code-audit` skill (below); these files are the annotated, human-readable versions.

| Engine | Lens |
| --- | --- |
| [C](engines/c-cognitive-visual.md) | Cognitive load & visual hierarchy |
| [D](engines/d-designer-lens.md) | Senior designer judgment |
| [H](engines/h-heuristic-navigation.md) | Usability heuristics & navigation |
| [I](engines/i-interaction-cost.md) | Interaction cost |
| [SL](engines/sl-system-logic-flow.md) | State, feedback, error handling, flow logic |
| [X](engines/x-coherence.md) | Cross-sectional coherence (whole codebase) |

### `skills/` — drop-in Claude Code skills
Two [Claude Code](https://claude.com/claude-code) skills that apply these prompts as Claude's own rubric, so Claude *is* the auditor. Both are **self-contained**: the prompts each one uses are bundled inside its own folder, so they work in any project once copied in.

| Skill | Audits | Bundled prompts |
| --- | --- | --- |
| [`q-visual-audit`](skills/q-visual-audit/) | a screen, flow, or prototype (screenshots / live / Figma) | the `prompts/` image set |
| [`q-code-audit`](skills/q-code-audit/) | a codebase from **source only** (the six engines) | the `engines/` set |

## How to use it

**Path A — in Claude Code (no setup beyond copying a folder).**
Copy the skill folder you want — `skills/q-visual-audit/` or `skills/q-code-audit/` — into your project's `.claude/skills/`, then run `/q-visual-audit` on a screen or flow, or `/q-code-audit` on your source. Claude reads the bundled rubric and audits.

**Path B — raw, with any vision LLM.**
Open any file in `prompts/`, copy the block under `~~~text`, fill in the `{placeholders}` (each file lists what they mean), and send it to a vision-capable model alongside your screenshot(s). The first image is the audit target; later images are context only.

The `{placeholders}` are slots the application filled at call time (the product's mission, the target persona, the screen description, etc.). They're documented per-file; supply your own values.

## License

MIT — see [`LICENSE`](LICENSE). The prompts are provided as-is for reference and reuse.
