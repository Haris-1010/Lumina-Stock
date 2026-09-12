import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Currencies whose standard subunit is 0 (no minor unit). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", "KRW", "CLP", "ISK", "PYG", "VND", "UGX",
  "HUF", "TWD", "BYN", "XAF", "XOF", "XPF",
]);

/**
 * Return the standard number of decimal places for a currency code.
 * Falls back to 2 for unknown currencies (the most common case).
 */
function currencyDecimals(code: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  // BHD, JOD, KWD, OMR use 3 decimals
  if (code === "BHD" || code === "JOD" || code === "KWD" || code === "OMR") return 3;
  return 2;
}

/**
 * Format a number as a currency string.
 *
 * ⚠️ This function explicitly sets `minimumFractionDigits` and
 * `maximumFractionDigits` to the currency's standard value to ensure the
 * output is IDENTICAL between server (Node.js) and client (browser).
 * Without this, different Intl implementations can disagree on whether to
 * show `.00` for currencies like PKR, causing React hydration mismatches.
 */
export function formatCurrency(
  amount: number,
  currencyCode = "PKR",
  locale = "en-US"
): string {
  const digits = currencyDecimals(currencyCode);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
