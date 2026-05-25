const base = require("./eslint.fixture.config.js");
const path = require("node:path");
module.exports = base.map((b) => ({
  ...b,
  rules: {
    "import/no-restricted-paths": ["error", {
      zones: [
        { target: "./IMPORT-003.ts", from: "../../src/components", except: ["./ui"] },
      ],
    }],
  },
}));
