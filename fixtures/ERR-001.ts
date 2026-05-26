/* eslint no-empty: ["error", { "allowEmptyCatch": false }] */

export async function bad() {
  try { JSON.parse("{}"); } catch (e) {}
}
export async function good() {
  try { JSON.parse("{}"); } catch (e) { console.error(e); }
}
// .catch(() => {}) — not covered by no-empty
export async function badPromise() {
  await Promise.resolve().catch(() => {});
}
