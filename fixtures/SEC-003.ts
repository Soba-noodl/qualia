/* eslint no-restricted-syntax: ["error", { "selector": "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']", "message": "SEC-003: server-only" }, { "selector": "Literal[value='SUPABASE_SERVICE_ROLE_KEY']", "message": "SEC-003: server-only" }] */

const a = process.env.SUPABASE_SERVICE_ROLE_KEY;
const b = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const c = process.env.OTHER_KEY;
export { a, b, c };
