/* eslint @typescript-eslint/ban-ts-comment: ["warn", { "ts-ignore": true, "ts-expect-error": false, "ts-nocheck": true, "ts-check": false }] */

// @ts-ignore — should fire
const a: number = "x" as any;

// @ts-expect-error — should NOT fire (allowed)
const b: number = "x" as any;

export { a, b };
