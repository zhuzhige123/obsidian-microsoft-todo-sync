import { en } from "./en";
import { zh } from "./zh";
import type { MtdStrings, ResolvedLocale, UiLanguage } from "./types";

const catalogs: Record<ResolvedLocale, MtdStrings> = { en, zh };

export function resolveLocale(language: UiLanguage): ResolvedLocale {
  if (language === "en" || language === "zh") {
    return language;
  }
  const docLang = globalThis.document?.documentElement?.lang?.toLowerCase() ?? "";
  if (docLang.startsWith("zh")) {
    return "zh";
  }
  return "en";
}

export function getStrings(language: UiLanguage): MtdStrings {
  return catalogs[resolveLocale(language)];
}

export function formatString(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export type { MtdStrings, ResolvedLocale, UiLanguage } from "./types";
