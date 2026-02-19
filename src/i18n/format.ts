import type { Locale } from "./index.ts";

export interface FiatParts {
  currency: string; // e.g., "$", "US$"
  integer: string; // e.g., "1,234" (EN) or "1.234" (ES)
  decimal: string; // e.g., ".56" (EN) or ",56" (ES) — includes separator
}

/**
 * Format a numeric amount as locale-aware USD currency parts.
 * Uses Intl.NumberFormat.formatToParts() for correctness.
 */
export function formatFiat(amount: number, locale: Locale): FiatParts {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const parts = formatter.formatToParts(amount);

  let currency = "";
  let integer = "";
  let decimal = "";
  let inDecimal = false;

  for (const part of parts) {
    switch (part.type) {
      case "currency":
        currency += part.value;
        break;
      case "decimal":
        inDecimal = true;
        decimal += part.value;
        break;
      case "fraction":
        decimal += part.value;
        break;
      case "integer":
      case "group":
        if (inDecimal) {
          decimal += part.value;
        } else {
          integer += part.value;
        }
        break;
      // literal (spacing around currency) — append to currency
      case "literal":
        if (!integer && !inDecimal) {
          currency += part.value;
        }
        break;
    }
  }

  return { currency: currency.trim(), integer, decimal };
}

/**
 * Format FiatParts back to a flat string (for contexts that need it).
 */
export function fiatPartsToString(parts: FiatParts): string {
  return `${parts.currency}${parts.integer}${parts.decimal}`;
}

/**
 * Parse a "$XX.XX" string to a number. Used for external props
 * (shipping, total, items[].price) that arrive as pre-formatted strings.
 */
export function parseFiatString(value: string): number {
  // Strip currency symbol and any non-numeric chars except dot/minus
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  return parseFloat(cleaned) || 0;
}
