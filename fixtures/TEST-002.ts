/* eslint no-only-tests/no-only-tests: ["warn", {"block": ["test", "it", "describe"], "focus": ["skip"]}] */

// no-only-tests doesn't do .skip — let me try just .skip restriction
// Actually no-only-tests is for .only.
// Let me try: are there any plugins for no-skip-without-comment?
test.skip("missing reason", () => {});
// reason: flaky on CI #123
test.skip("with reason", () => {});

declare function test(name: string, fn: () => void): void;
declare namespace test { function skip(name: string, fn: () => void): void; }
export {};
