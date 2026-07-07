/**
 * Unit tests for the qualia-compliance ESLint plugin rules.
 * Uses the official ESLint RuleTester.
 */
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dsColor002 = require('../rules/ds-color-002-no-yellow.cjs');
const dsA11y005 = require('../rules/ds-a11y-005-focus-visible.cjs');
const dsA11y010 = require('../rules/ds-a11y-010-dialog-title.cjs');
const dsColor001 = require('../rules/ds-color-001-no-raw-palette.cjs');

// Wave 3c rules
const dsSpacing001 = require('../rules/ds-spacing-001-no-off-scale-gap.cjs');
const dsTypo005 = require('../rules/ds-typo-005-heading-tracking-tight.cjs');
const test002 = require('../rules/test-002-skip-needs-comment.cjs');
const dsSpacing004 = require('../rules/ds-spacing-004-no-p4-on-card-surface.cjs');
const dsTypo002 = require('../rules/ds-typo-002-hint-vs-description-size.cjs');
const sec004 = require('../rules/sec-004-import-meta-env-allowlist.cjs');
const dsSpacing005 = require('../rules/ds-spacing-005-label-input-spacing.cjs');
const dsPrimitive009 = require('../rules/ds-primitive-009-alertdialog-for-destructive.cjs');
const effect001 = require('../rules/effect-001-cleanup-required.cjs');
const err003 = require('../rules/err-003-mutation-onerror-required.cjs');
const err004 = require('../rules/err-004-throw-english-only.cjs');

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

describe('ds-color-002-no-yellow', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-color-002-no-yellow', dsColor002, {
      valid: [
        { code: 'const a = <div className="bg-amber-500" />;' },
        { code: 'const a = <div className="bg-yellow" />;' },
        { code: 'const a = <div className="bg-primary" />;' },
      ],
      invalid: [
        {
          code: 'const a = <div className="bg-yellow-500" />;',
          output: 'const a = <div className="bg-amber-500" />;',
          errors: [{ messageId: 'noYellow' }],
        },
        {
          code: 'const a = <div className="text-yellow-50 border-yellow-200" />;',
          output: 'const a = <div className="text-amber-50 border-amber-200" />;',
          errors: [{ messageId: 'noYellow' }],
        },
      ],
    });
  });
});

describe('ds-color-001-no-raw-palette', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-color-001-no-raw-palette', dsColor001, {
      valid: [
        { code: 'const a = <div className="bg-primary" />;' },
        { code: 'const a = <div className="bg-amber-500" />;' },
        { code: 'const a = <div className="bg-green-400 text-red-400" />;' },
        { code: 'const a = <div className="bg-yellow-500" />;' },
      ],
      invalid: [
        {
          code: 'const a = <div className="bg-blue-500" />;',
          errors: [{ messageId: 'noRawPalette' }],
        },
        {
          code: 'const a = <div className="text-violet-500" />;',
          errors: [{ messageId: 'noRawPalette' }],
        },
        {
          code: 'const a = <div className="border-slate-300" />;',
          errors: [{ messageId: 'noRawPalette' }],
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Wave 3c tests
// ---------------------------------------------------------------------------

describe('ds-spacing-001-no-off-scale-gap', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-spacing-001-no-off-scale-gap', dsSpacing001, {
      valid: [
        { code: 'const a = <div className="gap-4" />;' },
        { code: 'const a = <div className="gap-0.5 space-x-2 space-y-1.5" />;' },
        { code: 'const a = <div className="gap-[32px]" />;' },
        { code: 'const a = <div className="p-4 m-4" />;' },
      ],
      invalid: [
        {
          code: 'const a = <div className="gap-7" />;',
          errors: [{ messageId: 'offScale' }],
        },
        {
          code: 'const a = <div className="space-x-9" />;',
          errors: [{ messageId: 'offScale' }],
        },
        {
          code: 'const a = <div className="space-y-7" />;',
          errors: [{ messageId: 'offScale' }],
        },
      ],
    });
  });
});

describe('ds-typo-005-heading-tracking-tight', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-typo-005-heading-tracking-tight', dsTypo005, {
      valid: [
        { code: 'const a = <h1 className="tracking-tight text-2xl">Title</h1>;' },
        { code: 'const a = <h2 className="text-xl tracking-tight">Sub</h2>;' },
        { code: 'const a = <h3 className="text-lg">Not checked</h3>;' },
        { code: 'const a = <p className="text-sm">Paragraph</p>;' },
      ],
      invalid: [
        {
          code: 'const a = <h1 className="text-2xl">Missing tight</h1>;',
          errors: [{ messageId: 'noTrackingTight' }],
        },
        {
          code: 'const a = <h2 className="text-xl font-bold">No tracking</h2>;',
          errors: [{ messageId: 'noTrackingTight' }],
        },
        {
          code: 'const a = <h1>No className at all</h1>;',
          errors: [{ messageId: 'noTrackingTight' }],
        },
      ],
    });
  });
});

describe('test-002-skip-needs-comment', () => {
  it('runs the RuleTester suite', () => {
    tester.run('test-002-skip-needs-comment', test002, {
      valid: [
        // SKIP: with reason
        {
          code: [
            '// SKIP: flaky on CI',
            'it.skip("test name", () => {});',
          ].join('\n'),
        },
        // TODO(@user)
        {
          code: [
            '// TODO(@andrea)',
            'describe.skip("suite", () => {});',
          ].join('\n'),
        },
        // JIRA ticket
        {
          code: [
            '// PROJ-123',
            'test.skip("something", () => {});',
          ].join('\n'),
        },
        // Date
        {
          code: [
            '// 2026-05-08',
            'it.skip("dated skip", () => {});',
          ].join('\n'),
        },
        // Regular method call named skip not on it/describe/test
        {
          code: 'router.skip("something");',
        },
      ],
      invalid: [
        {
          code: 'it.skip("no comment", () => {});',
          errors: [{ messageId: 'noComment' }],
        },
        {
          code: [
            '// just a comment with no ticket',
            'describe.skip("missing ticket", () => {});',
          ].join('\n'),
          errors: [{ messageId: 'noComment' }],
        },
        {
          code: [
            'const x = 1;',
            '',
            'test.skip("two lines above", () => {});',
          ].join('\n'),
          errors: [{ messageId: 'noComment' }],
        },
      ],
    });
  });
});

describe('ds-spacing-004-no-p4-on-card-surface', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-spacing-004-no-p4-on-card-surface', dsSpacing004, {
      valid: [
        { code: 'const a = <Card className="p-5" />;' },
        { code: 'const a = <Card className="p-6 text-sm" />;' },
        { code: 'const a = <div className="p-4 text-sm" />;' },
        { code: 'const a = <div className="glass p-5" />;' },
        { code: 'const a = <Card className="gap-4" />;' },
      ],
      invalid: [
        {
          code: 'const a = <Card className="p-4" />;',
          errors: [{ messageId: 'noP4' }],
        },
        {
          code: 'const a = <div className="glass p-4 rounded-lg" />;',
          errors: [{ messageId: 'noP4' }],
        },
      ],
    });
  });
});

describe('ds-typo-002-hint-vs-description-size', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-typo-002-hint-vs-description-size', dsTypo002, {
      valid: [
        { code: 'const a = (<FormControl><p className="text-xs">Hint text</p></FormControl>);' },
        { code: 'const a = (<div><h2>Title</h2><p className="text-sm">Description</p></div>);' },
        { code: 'const a = <p className="text-sm">Normal paragraph</p>;' },
        { code: 'const a = (<div><h3>Sub</h3><p className="text-xs">Fine</p></div>);' },
      ],
      invalid: [
        {
          code: 'const a = (<FormControl><p className="text-sm">Wrong size</p></FormControl>);',
          errors: [{ messageId: 'hintShouldBeXs' }],
        },
        {
          code: 'const a = (<div><h2>Title</h2><p className="text-xs">Wrong size</p></div>);',
          errors: [{ messageId: 'descShouldBeSm' }],
        },
      ],
    });
  });
});

describe('sec-004-import-meta-env-allowlist', () => {
  it('runs the RuleTester suite', () => {
    tester.run('sec-004-import-meta-env-allowlist', sec004, {
      valid: [
        { code: 'const x = import.meta.env.VITE_SUPABASE_URL;' },
        { code: 'const x = import.meta.env.MODE;' },
        { code: 'const x = import.meta.env.DEV;' },
        { code: 'const x = import.meta.env.VITE_POSTHOG_KEY;' },
      ],
      invalid: [
        {
          code: 'const x = import.meta.env.SECRET_TOKEN;',
          errors: [{ messageId: 'unknownEnvVar' }],
        },
        {
          code: 'const x = import.meta.env.MY_CUSTOM_VAR;',
          errors: [{ messageId: 'unknownEnvVar' }],
        },
      ],
    });
  });
});

describe('ds-spacing-005-label-input-spacing', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-spacing-005-label-input-spacing', dsSpacing005, {
      valid: [
        { code: 'const a = (<div className="space-y-1.5"><Label>Name</Label><Input /></div>);' },
        { code: 'const a = (<div className="space-y-2"><Label>Email</Label><Input /></div>);' },
        { code: 'const a = (<div className="space-y-3"><Label>Name</Label><p>No input</p></div>);' },
        { code: 'const a = (<div className="space-y-3"><div>x</div><Input /></div>);' },
      ],
      invalid: [
        {
          code: 'const a = (<div className="space-y-3"><Label>Name</Label><Input /></div>);',
          errors: [{ messageId: 'wrongSpacingY' }],
        },
        {
          code: 'const a = (<div className="space-y-4"><Label>Email</Label><Textarea /></div>);',
          errors: [{ messageId: 'wrongSpacingY' }],
        },
      ],
    });
  });
});

describe('ds-primitive-009-alertdialog-for-destructive', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-primitive-009-alertdialog-for-destructive', dsPrimitive009, {
      valid: [
        { code: 'const a = (<Dialog><Button variant="default">Save</Button></Dialog>);' },
        { code: 'const a = (<AlertDialog><Button variant="destructive">Delete</Button></AlertDialog>);' },
        { code: 'const a = (<Dialog><Button variant="destructive">Submit</Button></Dialog>);' },
      ],
      invalid: [
        {
          code: 'const a = (<Dialog><Button variant="destructive">Delete Item</Button></Dialog>);',
          errors: [{ messageId: 'useAlertDialog' }],
        },
        {
          code: 'const a = (<Dialog><Button variant="destructive">Remove</Button></Dialog>);',
          errors: [{ messageId: 'useAlertDialog' }],
        },
        {
          code: 'const a = (<Dialog><Button variant="destructive">Discard Changes</Button></Dialog>);',
          errors: [{ messageId: 'useAlertDialog' }],
        },
      ],
    });
  });
});

describe('effect-001-cleanup-required', () => {
  it('runs the RuleTester suite', () => {
    tester.run('effect-001-cleanup-required', effect001, {
      valid: [
        { code: 'useEffect(() => { const id = setInterval(fn, 100); return () => clearInterval(id); }, []);' },
        { code: 'useEffect(() => { const t = setTimeout(fn, 500); return () => clearTimeout(t); }, []);' },
        { code: 'useEffect(() => { window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, []);' },
        { code: 'useEffect(() => { const sub = store.subscribe(fn); return () => sub.unsubscribe(); }, []);' },
        { code: 'useEffect(() => { doSomething(); }, []);' },
        { code: 'useEffect(() => { setInterval(fn, 100); return cleanup; }, []);' },
      ],
      invalid: [
        {
          code: 'useEffect(() => { setInterval(fn, 100); }, []);',
          errors: [{ messageId: 'missingCleanup' }],
        },
        {
          code: 'useEffect(() => { setTimeout(fn, 500); }, []);',
          errors: [{ messageId: 'missingCleanup' }],
        },
        {
          code: 'useEffect(() => { window.addEventListener("resize", fn); }, []);',
          errors: [{ messageId: 'missingCleanup' }],
        },
        {
          code: 'useEffect(() => { channel.subscribe(handler); }, []);',
          errors: [{ messageId: 'missingCleanup' }],
        },
      ],
    });
  });
});

describe('err-003-mutation-onerror-required', () => {
  it('runs the RuleTester suite', () => {
    tester.run('err-003-mutation-onerror-required', err003, {
      valid: [
        { code: 'useMutation({ mutationFn: fn, onError: handleErr });' },
        { code: 'useMutation({ mutationFn: fn, onError: (e) => toast.error(e.message) });' },
        { code: 'useMutation(fn, { onError: handleErr });' },
        { code: 'useQuery({ queryFn: fn });' },
      ],
      invalid: [
        {
          code: 'useMutation({ mutationFn: fn });',
          errors: [{ messageId: 'missingOnError' }],
        },
        {
          code: 'useMutation({ mutationFn: fn, onSuccess: () => {} });',
          errors: [{ messageId: 'missingOnError' }],
        },
        {
          code: 'useMutation(fn);',
          errors: [{ messageId: 'missingOnError' }],
        },
      ],
    });
  });
});

describe('err-004-throw-english-only', () => {
  it('runs the RuleTester suite', () => {
    tester.run('err-004-throw-english-only', err004, {
      valid: [
        { code: 'throw new Error("Something went wrong");' },
        { code: 'throw new Error("Failed to fetch data: " + message);' },
        { code: 'throw new Error(`Failed: ${reason}`);' },
        { code: 'throw new TypeError("Invalid argument");' },
        { code: 'throw new Error(message);' },
      ],
      invalid: [
        // Italian — è is non-ASCII
        {
          code: 'throw new Error("Qualcosa è andato storto");',
          errors: [{ messageId: 'nonAsciiError' }],
        },
        // German umlaut
        {
          code: 'throw new Error("Ungültiger Wert");',
          errors: [{ messageId: 'nonAsciiError' }],
        },
        // Template literal with em dash (non-ASCII)
        {
          code: 'throw new Error(`Errore: ${msg} — non valido`);',
          errors: [{ messageId: 'nonAsciiError' }],
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Wave 3d tests
// ---------------------------------------------------------------------------

describe('ds-a11y-005-focus-visible', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-a11y-005-focus-visible', dsA11y005, {
      valid: [
        // Element has focus-visible: in className
        { code: 'const a = <div onClick={() => {}} className="block focus-visible:ring-2">x</div>;' },
        { code: 'const a = <a onClick={() => {}} className="focus-visible:outline-none focus-visible:ring-2">x</a>;' },
        // Capitalized component — not in lowercase allow-list
        { code: 'const a = <Button onClick={() => {}}>x</Button>;' },
        { code: 'const a = <MyCustomCard onClick={() => {}}>x</MyCustomCard>;' },
        // No onClick — rule doesn't fire
        { code: 'const a = <div className="block">x</div>;' },
        // Native button — gets focus from browser/Button primitive
        { code: 'const a = <button onClick={() => {}}>x</button>;' },
        // Native input — excluded from allowlist
        { code: 'const a = <input type="text" onClick={() => {}} />;' },
      ],
      invalid: [
        {
          code: 'const a = <div onClick={() => {}} className="block p-4">x</div>;',
          errors: [{ messageId: 'noFocusVisible' }],
        },
        {
          code: 'const a = <span onClick={() => {}}>x</span>;',
          errors: [{ messageId: 'noFocusVisible' }],
        },
        {
          code: 'const a = <li onClick={() => {}} className="hover:bg-muted">x</li>;',
          errors: [{ messageId: 'noFocusVisible' }],
        },
      ],
    });
  });
});

describe('ds-a11y-010-dialog-title', () => {
  it('runs the RuleTester suite', () => {
    tester.run('ds-a11y-010-dialog-title', dsA11y010, {
      valid: [
        // Direct child Title
        { code: 'const a = <DialogContent><DialogTitle>Title</DialogTitle><div>body</div></DialogContent>;' },
        // Nested in any descendant
        { code: 'const a = <DialogContent><div><div><DialogTitle>Nested</DialogTitle></div></div></DialogContent>;' },
        // Wrapped in VisuallyHidden
        { code: 'const a = <DialogContent><VisuallyHidden><DialogTitle>Hidden</DialogTitle></VisuallyHidden></DialogContent>;' },
        // Conditional rendering
        { code: 'const a = <DialogContent>{showTitle && <DialogTitle>x</DialogTitle>}</DialogContent>;' },
        // Sheet variant
        { code: 'const a = <SheetContent><SheetTitle>Sheet</SheetTitle></SheetContent>;' },
        // AlertDialog variant
        { code: 'const a = <AlertDialogContent><AlertDialogTitle>Alert</AlertDialogTitle></AlertDialogContent>;' },
        // Drawer variant
        { code: 'const a = <DrawerContent><DrawerTitle>Drawer</DrawerTitle></DrawerContent>;' },
      ],
      invalid: [
        {
          code: 'const a = <DialogContent><div>body only</div></DialogContent>;',
          errors: [{ messageId: 'missingTitle' }],
        },
        {
          code: 'const a = <SheetContent>{children}</SheetContent>;',
          errors: [{ messageId: 'missingTitle' }],
        },
        {
          code: 'const a = <AlertDialogContent><AlertDialogDescription>desc</AlertDialogDescription></AlertDialogContent>;',
          errors: [{ messageId: 'missingTitle' }],
        },
      ],
    });
  });
});
