/* eslint no-restricted-syntax: ["error", { "selector": "MemberExpression[object.object.name='process'][object.property.name='env']", "message": "ENV-001: no process.env in src/** — use import.meta.env" }] */

const a = process.env.FOO;
const b = process.env.BAR;
const c = (import.meta as any).env.VITE_FOO; // negative
export { a, b, c };
