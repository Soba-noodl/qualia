/**
 * Verification fixture for DS-A11Y-007 jsx-a11y candidate rules.
 * This file is referenced in the Wave 3d implementation as evidence of
 * fixture-testing before enabling rules (Core Principle 4).
 *
 * Verified: jsx-a11y/prefer-tag-over-role
 *   - PASSES: <div role="navigation"> → fires "Use <nav> instead of the 'navigation' role"
 *   - PASSES: <nav aria-label="Primary"> → no violation (correct semantic element)
 *
 * Sub-check 3 (nav must have aria-label) investigation:
 *   - No jsx-a11y rule covers this: aria-role, role-has-required-aria-props,
 *     no-noninteractive-element-interactions all tested — none fire on bare <nav>.
 *   - Sub-check 3 is therefore audit-only (q-ux-audit handles it).
 *
 * Sub-check 1 (one <main> per route) and Sub-check 4 (<header>/<footer> semantics)
 * are runner-deferred / audit-only per spec.
 */

// Positive cases — should NOT fire with prefer-tag-over-role
function CompliantNav() {
  return <nav aria-label="Primary">items</nav>;
}

function MainContent() {
  return <main>content</main>;
}

// Negative cases — SHOULD fire with prefer-tag-over-role
function NavAsDiv() {
  return <div role="navigation">items</div>;
}

function MainAsDiv() {
  return <div role="main">content</div>;
}
