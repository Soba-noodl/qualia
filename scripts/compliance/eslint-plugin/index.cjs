/**
 * @qualia/eslint-plugin-compliance — project-local ESLint plugin
 * for the /q-compliance linter.
 *
 * Each rule corresponds to a row in the Hard Rules tables of
 * agent_docs/design-system.md or agent_docs/conventions.md.
 *
 * Convention: rule names mirror the Hard Rule ID, lowercased
 * with hyphen separators and a short suffix.
 *   `DS-COLOR-002` → `ds-color-002-no-yellow`
 */

const dsColor002NoYellow = require('./rules/ds-color-002-no-yellow.cjs');
const dsColor001NoRawPalette = require('./rules/ds-color-001-no-raw-palette.cjs');

// Wave 3c — simple custom rules
const dsSpacing001NoOffScaleGap = require('./rules/ds-spacing-001-no-off-scale-gap.cjs');
const dsSpacing004NoP4OnCardSurface = require('./rules/ds-spacing-004-no-p4-on-card-surface.cjs');
const dsSpacing005LabelInputSpacing = require('./rules/ds-spacing-005-label-input-spacing.cjs');
const dsTypo002HintVsDescriptionSize = require('./rules/ds-typo-002-hint-vs-description-size.cjs');
const dsTypo005HeadingTrackingTight = require('./rules/ds-typo-005-heading-tracking-tight.cjs');
const dsPrimitive009AlertdialogForDestructive = require('./rules/ds-primitive-009-alertdialog-for-destructive.cjs');
const effect001CleanupRequired = require('./rules/effect-001-cleanup-required.cjs');
const test002SkipNeedsComment = require('./rules/test-002-skip-needs-comment.cjs');
const sec004ImportMetaEnvAllowlist = require('./rules/sec-004-import-meta-env-allowlist.cjs');
const err003MutationOnerrorRequired = require('./rules/err-003-mutation-onerror-required.cjs');
const err004ThrowEnglishOnly = require('./rules/err-004-throw-english-only.cjs');

// Wave 3d — deferred a11y rules
const dsA11y005FocusVisible = require('./rules/ds-a11y-005-focus-visible.cjs');
const dsA11y010DialogTitle = require('./rules/ds-a11y-010-dialog-title.cjs');

module.exports = {
  meta: {
    name: 'qualia-compliance',
    version: '0.1.0',
  },
  rules: {
    'ds-color-002-no-yellow': dsColor002NoYellow,
    'ds-color-001-no-raw-palette': dsColor001NoRawPalette,
    // Wave 3c
    'ds-spacing-001-no-off-scale-gap': dsSpacing001NoOffScaleGap,
    'ds-spacing-004-no-p4-on-card-surface': dsSpacing004NoP4OnCardSurface,
    'ds-spacing-005-label-input-spacing': dsSpacing005LabelInputSpacing,
    'ds-typo-002-hint-vs-description-size': dsTypo002HintVsDescriptionSize,
    'ds-typo-005-heading-tracking-tight': dsTypo005HeadingTrackingTight,
    'ds-primitive-009-alertdialog-for-destructive': dsPrimitive009AlertdialogForDestructive,
    'effect-001-cleanup-required': effect001CleanupRequired,
    'test-002-skip-needs-comment': test002SkipNeedsComment,
    'sec-004-import-meta-env-allowlist': sec004ImportMetaEnvAllowlist,
    'err-003-mutation-onerror-required': err003MutationOnerrorRequired,
    'err-004-throw-english-only': err004ThrowEnglishOnly,
    // Wave 3d
    'ds-a11y-005-focus-visible': dsA11y005FocusVisible,
    'ds-a11y-010-dialog-title': dsA11y010DialogTitle,
  },
};
