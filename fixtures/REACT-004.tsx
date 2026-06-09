/* eslint no-restricted-syntax: ["warn", {"selector": "CallExpression[callee.object.name='document'][callee.property.name=/^(querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)$/]", "message": "REACT-004: no direct DOM access"}] */

export function Bad() {
  document.querySelector(".foo");
  document.getElementById("x");
  return null;
}
export function Good() {
  return null;
}
