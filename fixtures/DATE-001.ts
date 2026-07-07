/* eslint no-restricted-syntax: ["error", { "selector": "CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]", "message": "DATE-001: use @/lib/dateFormat helpers" }] */

const d = new Date();
const a = d.toLocaleString();
const b = d.toLocaleDateString();
const c = d.toLocaleTimeString();
const n = (12345).toLocaleString(); // false-positive — number formatting is allowed by DATE-003
export { a, b, c, n };
