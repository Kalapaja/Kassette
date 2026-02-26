import { Injectable, signal, computed } from '@angular/core';

import {
  t,
  detectLocale,
  type Locale,
  type TranslationKey,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
} from '@/app/i18n/index';
import { formatFiat, type FiatParts } from '@/app/i18n/format';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  /** Reactive locale signal, initialized from localStorage / navigator / fallback. */
  readonly locale = signal<Locale>(detectLocale());

  /** All supported locales exposed for language-switcher UIs. */
  readonly supportedLocales = SUPPORTED_LOCALES;

  /** Human-readable labels keyed by locale code (e.g. { en: "EN", es: "ES" }). */
  readonly localeLabels = LOCALE_LABELS;

  /** Computed human-readable label for the active locale. */
  readonly activeLabel = computed(() => LOCALE_LABELS[this.locale()]);

  /**
   * Translate a key with optional parameter interpolation.
   * Delegates to the pure `t()` function using the current locale.
   */
  t(key: TranslationKey, params?: Record<string, string>): string {
    return t(this.locale(), key, params);
  }

  /**
   * Change the active locale and persist the choice to localStorage.
   */
  setLocale(locale: Locale): void {
    this.locale.set(locale);
    globalThis.localStorage?.setItem('kp-locale', locale);
  }

  /**
   * Format a numeric amount as locale-aware USD currency parts.
   * Delegates to the pure `formatFiat()` function using the current locale.
   */
  formatFiat(amount: number): FiatParts {
    return formatFiat(amount, this.locale());
  }
}
