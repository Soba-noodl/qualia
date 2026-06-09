const base = require("./eslint.fixture.config.js");
module.exports = base.map((b) => ({
  ...b,
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/figma-plugin/*", "**/figma-plugin/**"], message: "IMPORT-002: separate apps" },
      ],
    }],
  },
}));
