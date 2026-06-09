const base = require("./eslint.fixture.config.js");
module.exports = base.map((b) => ({
  ...b,
  rules: {
    // In production this rule lives in a flat-config block scoped to
    // `files: ["src/components/ui/**/*.{ts,tsx}"]`. We only need positive
    // groups; the file-scope (not the negation) excludes ui→ui imports.
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/components/*", "@/components/!(ui)/**", "@/hooks/*", "@/hooks/**", "@/services/*", "@/services/**"], message: "IMPORT-003: ui primitives are leaves" },
      ],
    }],
  },
}));
