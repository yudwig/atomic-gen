import globals from "globals";
import pluginJs from "@eslint/js";
import typescriptEslintParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["./src/**/*.ts"],
  },
  pluginJs.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      }
    }
  },
  {
    languageOptions: {
      parser: typescriptEslintParser,
    },
  },
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
  },
];
