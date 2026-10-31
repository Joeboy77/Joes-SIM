import globals from "globals";
import root from "../../eslint.config.mjs";

export default [
  ...root,
  // The element runs in web pages, as a plain script.
  { files: ["src/joes-sim.js"], languageOptions: { globals: globals.browser } },
];
