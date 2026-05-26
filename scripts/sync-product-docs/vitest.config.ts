import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "../.."),
  test: {
    environment: "node",
    globals: false,
    include: ["scripts/sync-product-docs/**/*.test.ts"],
  },
});
