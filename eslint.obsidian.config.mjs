import { defineConfig } from "eslint/config";
import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["main.js", "dist/**", "node_modules/**", "src/**/*.test.ts"],
  },
  ...obsidianmd.configs.recommendedWithLocalesEn,
  {
    files: ["src/i18n/**/*.ts"],
    rules: {
      "obsidianmd/ui/sentence-case-locale-module": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
