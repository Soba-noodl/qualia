import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: [
      "scripts/compliance/**/*.test.ts",
      "scripts/compliance/**/*.test.js",
      "scripts/compliance/**/*.test.mjs",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "../../src") },
  },
});
