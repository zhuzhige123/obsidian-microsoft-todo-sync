import { defineConfig } from "eslint/config";
import json from "@eslint/json";
import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import { PlainTextParser } from "eslint-plugin-obsidianmd/dist/lib/plainTextParser.js";

export default defineConfig([
  {
    ignores: ["main.js", "dist/**", "node_modules/**", "src/**/*.test.ts", "src/test/**"],
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
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["Microsoft", "Obsidian", "Markdown", "To Do"],
          acronyms: ["API", "CM6", "HTML", "HTTP", "HTTPS", "ISO", "OAuth", "PKCE", "URL"],
        },
      ],
    },
  },
  {
    files: ["manifest.json"],
    language: "json/json",
    plugins: {
      obsidianmd,
      json,
    },
    rules: {
      "no-irregular-whitespace": "off",
      "obsidianmd/validate-manifest": "error",
    },
  },
  {
    files: ["LICENSE"],
    plugins: {
      obsidianmd,
    },
    languageOptions: {
      parser: PlainTextParser,
      parserOptions: {
        extraFileExtensions: [""],
      },
    },
    rules: {
      "no-irregular-whitespace": "off",
      "no-unused-vars": "off",
      "no-undef": "off",
      "obsidianmd/validate-license": "error",
    },
  },
]);
