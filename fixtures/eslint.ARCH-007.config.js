const base = require("./eslint.fixture.config.js");
module.exports = base.map((b) => ({
  ...b,
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group: ["**/ui/*", "**/ui/**"], message: "ARCH-007: sandbox cannot import from ui/" }] }],
  },
}));
