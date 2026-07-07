/* eslint no-restricted-syntax: ["error", { "selector": "TSAsExpression[typeAnnotation.type='TSAnyKeyword']", "message": "TYPE-002: no `as any` casts" }] */

export const bad = ({ x: 1 } as any);
// negative — `as unknown as T` does not match
type T = { x: number };
export const good = ({ x: 1 } as unknown as T);
