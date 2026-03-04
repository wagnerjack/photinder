import globals from "globals";

export default [
  {
    files: ["content.js", "background.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/"],
  },
];
