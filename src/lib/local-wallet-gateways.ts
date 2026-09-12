import { createHmac, timingSafeEqual } from "node:crypto";

export type LocalWalletGateway = "JAZZCASH" | "EASYPAISA";

interface JazzCashConfig {
  merchantId: string;
  password: string;
  integritySalt: string;
  txnType: string;
  language: string;
  currency: string;
  version: string;
  apiUrl: string;
  returnUrl: string;
  expiryMinutes: number;
}

interface EasyPaisaConfig {
  storeId: string;
  hashKey: string;
  apiUrl: string;
  returnUrl: string;
  currency: string;
  expiryMinutes: number;
}

function mustEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function toYmdHis(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${hh}${mm}${ss}`;
}

function toPaisa(amount: number): string {
  const value = Math.max(1, Math.round(amount * 100));
  return String(value);
}

function normalizeRecord(record: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

function canonicalWithKeys(payload: Record<string, string>, ignoredKeys: string[]): string {
  const ignored = new Set(ignoredKeys);
  return Object.keys(payload)
    .filter((key) => !ignored.has(key))
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${key}=${payload[key]}`)
    .join("&");
}

function canonicalWithValues(payload: Record<string, string>, ignoredKeys: string[]): string {
  const ignored = new Set(ignoredKeys);
  return Object.keys(payload)
    .filter((key) => !ignored.has(key))
    .sort((left, right) => left.localeCompare(right))
    .map((key) => payload[key])
    .join("&");
}

function hmacSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function equalsIgnoreCaseSafe(left: string, right: string): boolean {
  if (!left || !right) return false;
  const l = left.toLowerCase();
  const r = right.toLowerCase();
  if (l.length !== r.length) return false;
  return timingSafeEqual(Buffer.from(l, "utf8"), Buffer.from(r, "utf8"));
}

export function getJazzCashConfig(origin: string): JazzCashConfig {
  return {
    merchantId: mustEnv("JAZZCASH_MERCHANT_ID"),
    password: mustEnv("JAZZCASH_PASSWORD"),
    integritySalt: mustEnv("JAZZCASH_INTEGRITY_SALT"),
    txnType: optionalEnv("JAZZCASH_TXN_TYPE", "MWALLET"),
    language: optionalEnv("JAZZCASH_LANGUAGE", "EN"),
    currency: optionalEnv("JAZZCASH_CURRENCY", "PKR"),
    version: optionalEnv("JAZZCASH_VERSION", "1.1"),
    apiUrl: optionalEnv(
      "JAZZCASH_API_URL",
      "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction"
    ),
    returnUrl: optionalEnv("JAZZCASH_RETURN_URL", `${origin}/api/payments/confirm?gateway=JAZZCASH`),
    expiryMinutes: Number.parseInt(optionalEnv("JAZZCASH_EXPIRY_MINUTES", "120"), 10),
  };
}

export function getEasyPaisaConfig(origin: string): EasyPaisaConfig {
  return {
    storeId: mustEnv("EASYPAISA_STORE_ID"),
    hashKey: mustEnv("EASYPAISA_HASH_KEY"),
    apiUrl: optionalEnv(
      "EASYPAISA_API_URL",
      "https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction"
    ),
    returnUrl: optionalEnv("EASYPAISA_RETURN_URL", `${origin}/api/payments/confirm?gateway=EASYPAISA`),
    currency: optionalEnv("EASYPAISA_CURRENCY", "PKR"),
    expiryMinutes: Number.parseInt(optionalEnv("EASYPAISA_EXPIRY_MINUTES", "120"), 10),
  };
}

export function signJazzCashPayload(payload: Record<string, string>, integritySalt: string): string {
  const normalized = normalizeRecord(payload);
  const withKeys = canonicalWithKeys(normalized, ["pp_SecureHash"]);
  return hmacSha256(integritySalt, withKeys);
}

export function verifyJazzCashSignature(payload: Record<string, string>): boolean {
  const provided = payload.pp_SecureHash || payload.secureHash || "";
  if (!provided) return false;

  const integritySalt = mustEnv("JAZZCASH_INTEGRITY_SALT");
  const normalized = normalizeRecord(payload);

  const candidates = [
    hmacSha256(integritySalt, canonicalWithKeys(normalized, ["pp_SecureHash", "secureHash"])),
    hmacSha256(
      integritySalt,
      `${integritySalt}&${canonicalWithValues(normalized, ["pp_SecureHash", "secureHash"])}`
    ),
    hmacSha256(integritySalt, canonicalWithValues(normalized, ["pp_SecureHash", "secureHash"])),
  ];

  return candidates.some((candidate) => equalsIgnoreCaseSafe(candidate, provided));
}

export function signEasyPaisaPayload(payload: Record<string, string>, hashKey: string): string {
  const normalized = normalizeRecord(payload);
  const withKeys = canonicalWithKeys(normalized, ["hash", "secureHash"]);
  return hmacSha256(hashKey, withKeys);
}

export function verifyEasyPaisaSignature(payload: Record<string, string>): boolean {
  const provided = payload.hash || payload.secureHash || "";
  if (!provided) return false;

  const hashKey = mustEnv("EASYPAISA_HASH_KEY");
  const normalized = normalizeRecord(payload);

  const candidates = [
    hmacSha256(hashKey, canonicalWithKeys(normalized, ["hash", "secureHash"])),
    hmacSha256(hashKey, canonicalWithValues(normalized, ["hash", "secureHash"])),
    hmacSha256(hashKey, `${hashKey}&${canonicalWithValues(normalized, ["hash", "secureHash"])}`),
  ];

  return candidates.some((candidate) => equalsIgnoreCaseSafe(candidate, provided));
}

export function buildJazzCashCheckoutPayload(input: {
  amount: number;
  transactionRef: string;
  invoiceId: string;
  invoiceNumber: string;
  description: string;
  returnUrl: string;
  customerMobile?: string;
  customerEmail?: string;
  organizationId?: string;
  billReference?: string;
  origin: string;
}): { actionUrl: string; fields: Record<string, string> } {
  const config = getJazzCashConfig(input.origin);
  const now = new Date();
  const expiry = new Date(now.getTime() + config.expiryMinutes * 60 * 1000);

  const fields: Record<string, string> = {
    pp_Version: config.version,
    pp_TxnType: config.txnType,
    pp_Language: config.language,
    pp_MerchantID: config.merchantId,
    pp_Password: config.password,
    pp_TxnRefNo: input.transactionRef,
    pp_Amount: toPaisa(input.amount),
    pp_TxnCurrency: config.currency,
    pp_TxnDateTime: toYmdHis(now),
    pp_BillReference: input.billReference || input.invoiceNumber,
    pp_Description: input.description,
    pp_TxnExpiryDateTime: toYmdHis(expiry),
    pp_ReturnURL: input.returnUrl || config.returnUrl,
  };

  if (input.customerMobile) fields.ppmpf_1 = input.customerMobile;
  if (input.customerEmail) fields.ppmpf_2 = input.customerEmail;
  fields.ppmpf_3 = input.invoiceId;
  if (input.organizationId) fields.ppmpf_4 = input.organizationId;

  fields.pp_SecureHash = signJazzCashPayload(fields, config.integritySalt);

  return { actionUrl: config.apiUrl, fields };
}

export function buildEasyPaisaCheckoutPayload(input: {
  amount: number;
  transactionRef: string;
  invoiceId: string;
  invoiceNumber: string;
  description: string;
  returnUrl: string;
  customerMobile?: string;
  customerEmail?: string;
  organizationId?: string;
  origin: string;
}): { actionUrl: string; fields: Record<string, string> } {
  const config = getEasyPaisaConfig(input.origin);
  const expiry = new Date(Date.now() + config.expiryMinutes * 60 * 1000).toISOString();

  const fields: Record<string, string> = {
    storeId: config.storeId,
    amount: input.amount.toFixed(2),
    transactionId: input.transactionRef,
    orderRefNum: input.invoiceNumber,
    postBackURL: input.returnUrl || config.returnUrl,
    transactionType: "MA",
    mobileAccountNo: input.customerMobile || "",
    emailAddr: input.customerEmail || "",
    expiryDate: expiry,
    currencyCode: config.currency,
    transactionDesc: input.description,
    merchantPaymentId: input.invoiceId,
    udf1: input.invoiceNumber,
    udf2: input.organizationId || "",
  };

  fields.hash = signEasyPaisaPayload(fields, config.hashKey);

  return {
    actionUrl: config.apiUrl,
    fields,
  };
}

export function isGatewaySuccessStatus(gateway: LocalWalletGateway, payload: Record<string, string>): boolean {
  const normalized = (
    payload.pp_ResponseCode ||
    payload.pp_ResponseMessage ||
    payload.responseCode ||
    payload.status ||
    payload.transactionStatus ||
    ""
  )
    .toString()
    .trim()
    .toUpperCase();

  if (gateway === "JAZZCASH") {
    return normalized === "000" || normalized === "SUCCESS" || normalized === "COMPLETED";
  }

  return normalized === "0000" || normalized === "SUCCESS" || normalized === "COMPLETED";
}

export function extractGatewayAmount(payload: Record<string, string>, fallback: number): number {
  const raw =
    payload.amount ||
    payload.pp_Amount ||
    payload.txnAmount ||
    payload.transactionAmount ||
    "";

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;

  if (raw && !raw.includes(".") && parsed > 1000) {
    return Number((parsed / 100).toFixed(2));
  }

  return Number(parsed.toFixed(2));
}
