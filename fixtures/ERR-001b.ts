/* eslint no-restricted-syntax: ["error", { "selector": "CallExpression[callee.property.name='catch'][arguments.0.type='ArrowFunctionExpression'][arguments.0.body.type='BlockStatement'][arguments.0.body.body.length=0]", "message": "ERR-001: empty .catch arrow" }] */

export async function bad() {
  await Promise.resolve().catch(() => {});
}
export async function good() {
  await Promise.resolve().catch((e) => { console.error(e); });
}
