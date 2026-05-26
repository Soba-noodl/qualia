/* eslint no-restricted-syntax: ["warn", { "selector": "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]", "message": "NAV-002: use useNavigate()" }, { "selector": "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']", "message": "NAV-002: use useNavigate()" }] */

export function bad() {
  window.location.assign("/foo");
  window.location.replace("/foo");
  window.location.href = "/foo";
  const _x = window.location.href; // read OK — only assignment is the issue
  return _x;
}
export function good() {
  // pretend useNavigate
}
