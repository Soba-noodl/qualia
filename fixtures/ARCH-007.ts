// positive (this would be in figma-plugin/src/code.ts)
// @ts-ignore
import x from "./ui/components/Foo";
// @ts-ignore
import y from "../ui/messages";
// negative
// @ts-ignore
import z from "./shared";
export { x, y, z };
