/* eslint no-restricted-imports: ["warn", { "patterns": [{ "regex": "^\\.\\./\\.\\./" }] }] */

// positive: 2+ levels up
import x from "../../utils/foo";
// @ts-ignore
import y from "../../../services/bar";
// negative: sibling and one-level
import a from "./sibling";
// @ts-ignore
import b from "../parent";

export { x, y, a, b };
