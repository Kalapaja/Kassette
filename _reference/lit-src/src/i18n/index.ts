import { en } from "./locales/en.ts";
import { es } from "./locales/es.ts";

export type Locale = "en" | "es";
export type TranslationKey = keyof typeof en;

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "es"] as const;

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
};

const dictionaries: Record<Locale, Record<string, string>> = { en, es };

/**
 * Translate a key with optional parameter interpolation.
 * Falls back to English if key is missing in active locale.
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string>,
): string {
  const dict = dictionaries[locale] ?? dictionaries.en;
  let value = dict[key] ?? dictionaries.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, v);
    }
  }
  return value;
}

/**
 * Detect the best locale from localStorage → navigator → fallback.
 */
export function detectLocale(): Locale {
  // 1. localStorage
  const stored = globalThis.localStorage?.getItem("kp-locale");
  if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
    return stored as Locale;
  }

  // 2. navigator.languages
  const browserLangs = globalThis.navigator?.languages ?? [
    globalThis.navigator?.language,
  ];
  for (const lang of browserLangs) {
    if (!lang) continue;
    const base = lang.split("-")[0].toLowerCase();
    if (SUPPORTED_LOCALES.includes(base as Locale)) {
      return base as Locale;
    }
  }

  // 3. fallback
  return "en";
}

export { LOCALE_LABELS };
