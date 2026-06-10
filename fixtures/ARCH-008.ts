/* eslint no-restricted-syntax: ["warn", { "selector": "Literal[value=/^gemini-[a-z0-9.-]+$/]", "message": "ARCH-008: import the model name from _shared/" }] */

const a = "gemini-2.0-flash-exp"; // bad
const b = "gpt-4"; // OK
const c = "gemini-1.5-pro"; // bad
export { a, b, c };
