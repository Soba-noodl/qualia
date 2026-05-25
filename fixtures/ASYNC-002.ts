/* eslint require-await: "warn" */

export async function bad() {
  return 1; // no await
}
export async function good() {
  return await Promise.resolve(1);
}
