/* eslint no-restricted-syntax: ["error", { "selector": "CallExpression[callee.object.name='supabase'][callee.property.name='from']", "message": "ARCH-004: hooks own state; services own DB I/O" }] */

declare const supabase: any;
export function useThing() {
  return supabase.from("foo").select("*"); // bad
}
export function useThingGood() {
  return null;
}
