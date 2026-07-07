/* eslint no-restricted-syntax: ["error", {"selector": "CallExpression[callee.name='useQuery'] > ObjectExpression > Property[key.name='queryKey'] > ArrayExpression > Literal:first-child", "message": "QUERY-001: import from query-keys.ts"}] */

declare const useQuery: any;
declare const queryKeys: any;

export function bad() {
  return useQuery({ queryKey: ["audits", 1], queryFn: () => null });
}
export function good() {
  return useQuery({ queryKey: queryKeys.audits(1), queryFn: () => null });
}
