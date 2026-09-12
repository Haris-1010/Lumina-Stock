/**
 * Offline storage utilities — localStorage-backed product cache and
 * pending-operations queue for cashier sales and purchase orders.
 *
 * All writes are synchronous so they work without await in event handlers.
 */

import type { CashierSaleReceipt, CashierSaleUnit } from "@/lib/actions/cashier";

// ─── Keys ────────────────────────────────────────────────────────────────────

const KEY_PRODUCTS = "lumina:products_cache";
const KEY_PENDING_SALES = "lumina:pending_sales";
const KEY_PENDING_POS = "lumina:pending_pos";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CachedProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  sellingPrice: number;
  costPrice?: number;
}

export interface PendingSaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  saleUnit: CashierSaleUnit;
  discountPct?: number;
}

export interface PendingSale {
  id: string; // client-generated ID e.g. "PEND-abc123"
  createdAtIso: string;
  items: PendingSaleItem[];
  tenderedAmount: number;
  customerName: string | null;
  customerContact?: string | null; // legacy field retained for backward compat
  customerId?: string | null;
  /** Temp receipt shown locally while sale is pending sync */
  tempReceipt: CashierSaleReceipt;
}

export interface PendingPOLine {
  productId: string;
  quantity: number;
  cost: number;
}

export interface PendingPO {
  id: string; // client-generated e.g. "PEND-PO-xyz"
  createdAtIso: string;
  organizationId: string;
  supplierId: string;
  lines: PendingPOLine[];
}

// ─── Products cache ───────────────────────────────────────────────────────────

export function saveProductsCache(products: CachedProduct[]): void {
  try {
    localStorage.setItem(KEY_PRODUCTS, JSON.stringify(products));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function getProductsCache(): CachedProduct[] {
  try {
    const raw = localStorage.getItem(KEY_PRODUCTS);
    if (!raw) return [];
    return JSON.parse(raw) as CachedProduct[];
  } catch {
    return [];
  }
}

// ─── Pending sales ────────────────────────────────────────────────────────────

export function getPendingSales(): PendingSale[] {
  try {
    const raw = localStorage.getItem(KEY_PENDING_SALES);
    if (!raw) return [];
    return JSON.parse(raw) as PendingSale[];
  } catch {
    return [];
  }
}

function savePendingSales(sales: PendingSale[]): void {
  try {
    localStorage.setItem(KEY_PENDING_SALES, JSON.stringify(sales));
  } catch {
    // ignore
  }
}

export function queuePendingSale(sale: PendingSale): void {
  const existing = getPendingSales();
  savePendingSales([...existing, sale]);
}

export function removePendingSale(id: string): void {
  const existing = getPendingSales();
  savePendingSales(existing.filter((s) => s.id !== id));
}

export function pendingSalesCount(): number {
  return getPendingSales().length;
}

// ─── Pending purchase orders ──────────────────────────────────────────────────

export function getPendingPOs(): PendingPO[] {
  try {
    const raw = localStorage.getItem(KEY_PENDING_POS);
    if (!raw) return [];
    return JSON.parse(raw) as PendingPO[];
  } catch {
    return [];
  }
}

function savePendingPOs(pos: PendingPO[]): void {
  try {
    localStorage.setItem(KEY_PENDING_POS, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export function queuePendingPO(po: PendingPO): void {
  const existing = getPendingPOs();
  savePendingPOs([...existing, po]);
}

export function removePendingPO(id: string): void {
  const existing = getPendingPOs();
  savePendingPOs(existing.filter((p) => p.id !== id));
}

export function pendingPOsCount(): number {
  return getPendingPOs().length;
}

export function totalPendingCount(): number {
  return pendingSalesCount() + pendingPOsCount();
}

// ─── Temp ID generator ────────────────────────────────────────────────────────

export function generatePendingId(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `${prefix}-${ts}-${rand}`;
}
