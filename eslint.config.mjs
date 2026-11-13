import js from "@eslint/js";

export default [
  { ignores: ["**/.next/**", "**/node_modules/**", ".vercel/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        console: "readonly",
        process: "readonly",
        TextEncoder: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_|^[A-Z]", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^[A-Z]" },
      ],
    },
  },
  {
    files: ["src/server/**/*.js"],
    languageOptions: {
      globals: { Buffer: "readonly", AbortController: "readonly", AbortSignal: "readonly" },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
];
