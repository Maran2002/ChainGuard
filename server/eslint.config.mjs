import js from "@eslint/js";

export default [
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { globals: { process: "readonly", Buffer: "readonly", console: "readonly", URL: "readonly", URLSearchParams: "readonly", AbortController: "readonly", AbortSignal: "readonly", fetch: "readonly", setTimeout: "readonly", clearTimeout: "readonly" } },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }] },
  },
];
