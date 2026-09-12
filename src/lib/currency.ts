export const SUPPORTED_CURRENCIES = [
  { code: "PKR", label: "Pakistani Rupee" },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export function normalizeCurrencyCode(_value: string | null | undefined): SupportedCurrencyCode {
  return "PKR";
}

export function isSupportedCurrencyCode(value: string): value is SupportedCurrencyCode {
  return value?.toUpperCase() === "PKR";
}
