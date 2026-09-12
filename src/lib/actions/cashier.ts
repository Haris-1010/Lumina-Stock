"use server";

import { getReturnLedger } from "@/lib/return-data";
import { customerCode } from "@/lib/customer-code";
import { money } from "@/lib/returns-ledger";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireActionPermission, requirePagePermission } from "@/lib/permissions";
import { checkAndCreateLowStockNotifications } from "@/lib/actions/notifications";

export type CashierSaleUnit = "UNIT" | "DOZEN" | "KG";

export interface CashierCatalogItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  sellingPrice: number;
  costPrice: number;
}

export interface CashierCustomer {
  code: string;
  address: string | null;
  balance: number;
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface CashierCheckoutLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  saleUnit: CashierSaleUnit;
  /** 0–100 percentage discount applied to this line */
  discountPct?: number;
}

export interface CashierCheckoutInput {
  items: CashierCheckoutLineInput[];
  customerId?: string | null;
}

export interface CashierReceiptLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  saleUnit: CashierSaleUnit;
  stockUnitsDeducted: number;
  unitPrice: number;
  discountPct: number;
  discountAmount: number;
  lineTotal: number;
  remainingStock: number;
}

export interface CashierSaleReceipt {
  orderId: string;
  orderNumber: string;
  createdAtIso: string;
  /** Gross total before any discounts */
  subtotal: number;
  /** Total discount amount across all lines */
  discountTotal: number;
  /** Net total after discounts */
  totalAmount: number;
  returnedAmount?: number;
  netAmount?: number;
  itemCount: number;
  cashierName: string;
  customerName: string | null;
  organizationName: string;
  currencyCode: string;
  items: CashierReceiptLine[];
}

export interface CashierCheckoutResult {
  error?: string;
  receipt?: CashierSaleReceipt;
}

export interface GetPreviousPricesInput {
  customerId: string;
  productIds: string[];
}

export interface GetPreviousPricesResult {
  error?: string;
  prices?: Record<string, number>;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

/** Build a daily-sequential bill number: BILL-YYYYMMDD-001 (resets at midnight) */
async function createDailyBillNumber(organizationId: string): Promise<string> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const count = await db.salesOrder.count({
    where: {
      organizationId,
      date: { gte: dayStart, lte: dayEnd },
    },
  });

  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seq = String(count + 1).padStart(3, "0");
  return `BILL-${dateStr}-${seq}`;
}

function normalizeSaleUnit(value: string | null | undefined): CashierSaleUnit {
  if (value === "KG") return "KG";
  if (value === "DOZEN") return "DOZEN";
  return "UNIT";
}

function saleUnitMultiplier(saleUnit: CashierSaleUnit) {
  if (saleUnit === "DOZEN") return 12;
  if (saleUnit === "KG") return 1; // 1 kg = 1 stock unit; stock is tracked in natural units
  return 1;
}

function toStockUnits(saleUnit: CashierSaleUnit, quantity: number) {
  if (saleUnit === "KG") {
    return Math.round(quantity * saleUnitMultiplier(saleUnit));
  }

  return Math.floor(quantity * saleUnitMultiplier(saleUnit));
}

function stockUnitsToEnteredQuantity(saleUnit: CashierSaleUnit, stockUnits: number) {
  const divisor = saleUnitMultiplier(saleUnit);
  if (saleUnit === "KG") {
    return Number((stockUnits / divisor).toFixed(3));
  }

  return Number((stockUnits / divisor).toFixed(0));
}

function clampDiscountPct(raw: number | undefined | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function normalizeCheckoutItems(items: CashierCheckoutLineInput[]) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Add at least one item to complete checkout." } as const;
  }

  const merged = new Map<
    string,
    { quantity: number; unitPrice: number; saleUnit: CashierSaleUnit; requiredStockUnits: number; discountPct: number }
  >();

  for (const rawItem of items.slice(0, 200)) {
    const productId = String(rawItem.productId || "").trim();
    const saleUnit = normalizeSaleUnit(rawItem.saleUnit);
    const quantityInput = Number(rawItem.quantity);
    const quantity =
      saleUnit === "KG"
        ? Number(quantityInput.toFixed(3))
        : Math.floor(quantityInput);
    const unitPrice = toMoney(Number(rawItem.unitPrice));
    const discountPct = clampDiscountPct(rawItem.discountPct);

    if (!productId) {
      return { error: "One of the selected products is invalid." } as const;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: "Each line must have a quantity greater than 0." } as const;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: "Each line must have a valid sale price." } as const;
    }

    const requiredStockUnits = toStockUnits(saleUnit, quantity);
    if (!Number.isFinite(requiredStockUnits) || requiredStockUnits <= 0) {
      return { error: "One of the line quantities is too small for stock tracking." } as const;
    }

    const mergeKey = `${productId}:${saleUnit}:${unitPrice.toFixed(2)}:${discountPct.toFixed(2)}`;
    const existing = merged.get(mergeKey);
    if (existing) {
      merged.set(mergeKey, {
        quantity:
          saleUnit === "KG"
            ? Number((existing.quantity + quantity).toFixed(3))
            : existing.quantity + quantity,
        unitPrice,
        saleUnit,
        requiredStockUnits: existing.requiredStockUnits + requiredStockUnits,
        discountPct,
      });
    } else {
      merged.set(mergeKey, {
        quantity,
        unitPrice,
        saleUnit,
        requiredStockUnits,
        discountPct,
      });
    }
  }

  const normalized = Array.from(merged.entries()).map(([key, value]) => ({
    productId: key.split(":")[0],
    quantity: value.quantity,
    unitPrice: value.unitPrice,
    saleUnit: value.saleUnit,
    requiredStockUnits: value.requiredStockUnits,
    discountPct: value.discountPct,
  }));

  if (normalized.length === 0) {
    return { error: "Add at least one item to complete checkout." } as const;
  }

  return { lines: normalized } as const;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapSalesOrderToReceipt(input: {
  order: {
    id: string;
    orderNumber: string;
    date: Date;
    totalAmount: number;
    customer?: { name: string } | null;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
      metadata: unknown;
      product: {
        sku: string;
        name: string;
      };
    }>;
  };
  organizationName: string;
  currencyCode: string;
}): CashierSaleReceipt {
  const items: CashierReceiptLine[] = input.order.items.map((item) => {
    const metadata = asObject(item.metadata);
    const saleUnit = normalizeSaleUnit(
      typeof metadata.saleUnit === "string" ? metadata.saleUnit : null
    );
    const enteredQuantityRaw = Number(metadata.enteredQuantity);
    const enteredQuantity =
      Number.isFinite(enteredQuantityRaw) && enteredQuantityRaw > 0
        ? saleUnit === "KG"
          ? Number(enteredQuantityRaw.toFixed(3))
          : Math.floor(enteredQuantityRaw)
        : stockUnitsToEnteredQuantity(saleUnit, item.quantity);

    const discountPct = clampDiscountPct(
      typeof metadata.discountPct === "number" ? metadata.discountPct : 0
    );
    const lineGross = toMoney(enteredQuantity * item.price);
    const discountAmount = toMoney(lineGross * discountPct / 100);
    const lineTotal = toMoney(lineGross - discountAmount);

    return {
      productId: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      quantity: enteredQuantity,
      saleUnit,
      stockUnitsDeducted: item.quantity,
      unitPrice: toMoney(item.price),
      discountPct,
      discountAmount,
      lineTotal,
      remainingStock: 0,
    };
  });

  const firstItemMeta = asObject(input.order.items[0]?.metadata);
  const cashierName =
    typeof firstItemMeta.cashierName === "string" && firstItemMeta.cashierName.trim()
      ? firstItemMeta.cashierName.trim()
      : "—";

  const subtotal = toMoney(items.reduce((sum, l) => sum + toMoney(l.quantity * l.unitPrice), 0));
  const discountTotal = toMoney(items.reduce((sum, l) => sum + l.discountAmount, 0));

  return {
    orderId: input.order.id,
    orderNumber: input.order.orderNumber,
    createdAtIso: input.order.date.toISOString(),
    subtotal,
    discountTotal,
    totalAmount: toMoney(input.order.totalAmount),
    itemCount: Number(items.reduce((count, item) => count + item.quantity, 0).toFixed(3)),
    cashierName,
    customerName: input.order.customer?.name ?? null,
    organizationName: input.organizationName,
    currencyCode: input.currencyCode,
    items,
  };
}

export async function getCashierPageDataForCurrentOrganization(mode: "pos" | "history" = "pos") {
  const profile = await requirePagePermission(mode === "history" ? "sales" : "cashier");

  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const products = mode === "history" ? [] : await db.product.findMany({
    where: { organizationId: profile.user.organizationId, deletedAt: null },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      currentStock: true,
      sellingPrice: true,
      costPrice: true,
    },
    orderBy: { name: "asc" },
  });
  const salesOrders = mode === "pos" ? [] : await db.salesOrder.findMany({
    where: { organizationId: profile.user.organizationId, deletedAt: null },
    select: {
      id: true,
      orderNumber: true,
      date: true,
      totalAmount: true,
      customer: {
        select: { name: true },
      },
      items: {
        select: {
          productId: true,
          quantity: true,
          price: true,
          metadata: true,
          product: {
            select: {
              sku: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const customerRecords = mode === "history" ? [] : await db.customer.findMany({
    where: { organizationId: profile.user.organizationId, deletedAt: null },
    select: { id: true, name: true, phone: true, email: true, address: true, metadata: true },
    orderBy: { name: "asc" },
  });

  const unpaidInvoices = mode === "history" ? [] : await db.invoice.findMany({
    where: { organizationId: profile.user.organizationId, deletedAt: null, type: "SALES", status: { not: "CANCELLED" }, salesOrder: { customerId: { not: null }, deletedAt: null } },
    select: { balanceAmount: true, salesOrder: { select: { customerId: true } } },
  });
  const balances = new Map<string, number>();
  for (const invoice of unpaidInvoices) {
    const id = invoice.salesOrder?.customerId;
    if (id) balances.set(id, money((balances.get(id) ?? 0) + invoice.balanceAmount));
  }
  const customers: CashierCustomer[] = customerRecords.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, code: customerCode(c), balance: balances.get(c.id) ?? 0 }));

  const ledger = mode === "pos" ? [] : await getReturnLedger(profile.user.organizationId);
  const returnedAmounts = new Map<string, number>();
  for (const log of ledger) if (log.record?.salesOrderId) returnedAmounts.set(log.record.salesOrderId, money((returnedAmounts.get(log.record.salesOrderId) ?? 0) + log.record.refundAmount));
  const saleHistory = salesOrders.map((order) =>
    mapSalesOrderToReceipt({
      order,
      organizationName: profile.user.organization.name,
      currencyCode: profile.user.organization.currencyCode,
    })
  );

  const org = profile.user.organization as {
    name: string;
    currencyCode: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
  };

  const isAdmin = profile.user.role === "OWNER" || profile.user.role === "ADMIN";

  return {
    products,
    saleHistory: saleHistory.map(receipt => ({ ...receipt, returnedAmount: returnedAmounts.get(receipt.orderId) ?? 0, netAmount: money(receipt.totalAmount - (returnedAmounts.get(receipt.orderId) ?? 0)) })),
    customers,
    canCheckout: profile.permissions.actions.cashierCheckout,
    isAdmin,
    cashierName: profile.user.name,
    organizationName: org.name,
    currencyCode: org.currencyCode,
    orgLogoUrl: org.logoUrl ?? null,
    orgAddress: org.address ?? null,
    orgPhone: org.phone ?? null,
  };
}

export async function completeCashierSaleForCurrentOrganization(
  input: CashierCheckoutInput
): Promise<CashierCheckoutResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;

  try {
    profile = await requireActionPermission("cashierCheckout");
  } catch {
    return { error: "You do not have permission to complete cashier sales." };
  }

  const parsed = normalizeCheckoutItems(input.items);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const lines = parsed.lines;

  // Validate customer belongs to this org (if provided)
  let resolvedCustomer: { id: string; name: string } | null = null;
  if (input.customerId) {
    const found = await db.customer.findFirst({
      where: {
        id: input.customerId,
        organizationId: profile.user.organizationId,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
    if (!found) {
      return { error: "Selected customer not found." };
    }
    resolvedCustomer = found;
  }

  let orderNumber: string;
  try {
    orderNumber = await createDailyBillNumber(profile.user.organizationId);
  } catch {
    return { error: "Unable to generate bill number. Please try again." };
  }

  try {
    const receipt = await db.$transaction(async (tx) => {
      const productIds = Array.from(new Set(lines.map((line) => line.productId)));
      const products = await tx.product.findMany({
        where: {
          organizationId: profile.user.organizationId,
          id: { in: productIds },
        },
        select: {
          id: true,
          sku: true,
          name: true,
          currentStock: true,
        },
      }) as Array<{ id: string; sku: string; name: string; currentStock: number }>;

      if (products.length !== productIds.length) {
        throw new Error("Some selected products no longer exist in your inventory.");
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      const requiredStockByProductId = new Map<string, number>();

      for (const line of lines) {
        const existingRequired = requiredStockByProductId.get(line.productId) || 0;
        requiredStockByProductId.set(
          line.productId,
          existingRequired + line.requiredStockUnits
        );
      }

      // ── Atomic stock check + decrement ──────────────────────────
      // Instead of reading stock then decrementing (which has a race
      // window), we use conditional updateMany with `gte` to atomically
      // check AND deduct in one DB operation. If 0 rows affected, the
      // stock was insufficient and the transaction rolls back.
      for (const [productId, requiredQty] of requiredStockByProductId) {
        const updated = await tx.product.updateMany({
          where: {
            id: productId,
            organizationId: profile.user.organizationId,
            currentStock: { gte: requiredQty },
          },
          data: { currentStock: { decrement: requiredQty } },
        });

        if (updated.count === 0) {
          // Re-read to give a precise error message
          const stale = productById.get(productId);
          throw new Error(
            stale
              ? `Not enough stock for ${stale.name} (${stale.sku}).`
              : "Insufficient stock for one or more products."
          );
        }
      }

      // Re-read products to get the post-decrement stock values for the receipt
      const updatedProducts = await tx.product.findMany({
        where: { id: { in: productIds }, organizationId: profile.user.organizationId },
        select: { id: true, sku: true, name: true, currentStock: true },
      }) as Array<{ id: string; sku: string; name: string; currentStock: number }>;

      const updatedById = new Map(updatedProducts.map((p) => [p.id, p]));

      let grossSubtotal = 0;
      let discountTotal = 0;
      const receiptLines: CashierReceiptLine[] = [];

      for (const line of lines) {
        const product = updatedById.get(line.productId);
        if (!product) {
          throw new Error("A selected product could not be found.");
        }

        const nextRemaining = product.currentStock;

        const discountPct = line.discountPct ?? 0;
        const lineGross = toMoney(line.quantity * line.unitPrice);
        const lineDiscountAmt = toMoney(lineGross * discountPct / 100);
        const lineTotal = toMoney(lineGross - lineDiscountAmt);

        grossSubtotal = toMoney(grossSubtotal + lineGross);
        discountTotal = toMoney(discountTotal + lineDiscountAmt);

        receiptLines.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: line.quantity,
          saleUnit: line.saleUnit,
          stockUnitsDeducted: line.requiredStockUnits,
          unitPrice: line.unitPrice,
          discountPct,
          discountAmount: lineDiscountAmt,
          lineTotal,
          remainingStock: nextRemaining,
        });
      }

      const totalAmount = toMoney(grossSubtotal - discountTotal);

      const order = await tx.salesOrder.create({
        data: {
          organizationId: profile.user.organizationId,
          orderNumber,
          date: new Date(),
          totalAmount,
          customerId: resolvedCustomer?.id ?? null,
        },
      });

      await tx.orderItem.createMany({
        data: receiptLines.map((line, index) => ({
          salesOrderId: order.id,
          productId: line.productId,
          quantity: line.stockUnitsDeducted,
          price: line.unitPrice,
          metadata: {
            saleUnit: line.saleUnit,
            enteredQuantity: line.quantity,
            stockUnitsDeducted: line.stockUnitsDeducted,
            discountPct: line.discountPct,
            ...(index === 0 ? { cashierName: profile.user.name } : {}),
          } as object,
        })),
      });

      for (const line of receiptLines) {
        // Stock already decremented atomically above — only create the log entry
        await tx.inventoryLog.create({
          data: {
            organizationId: profile.user.organizationId,
            productId: line.productId,
            changeType: "SALE",
            quantity: line.stockUnitsDeducted,
            note: `Cashier checkout ${orderNumber} (${line.quantity} ${line.saleUnit})${line.discountPct > 0 ? ` [${line.discountPct}% disc]` : ""}`,
          },
        });
      }

      return {
        orderId: order.id,
        orderNumber,
        createdAtIso: order.date.toISOString(),
        subtotal: grossSubtotal,
        discountTotal,
        totalAmount,
        itemCount: Number(
          receiptLines.reduce((count, line) => count + line.quantity, 0).toFixed(3)
        ),
        cashierName: profile.user.name,
        customerName: resolvedCustomer?.name ?? null,
        organizationName: profile.user.organization.name,
        currencyCode: profile.user.organization.currencyCode,
        items: receiptLines,
      } satisfies CashierSaleReceipt;
    });

    for (const tag of ["inventory", "dashboard", "analytics"]) updateTag(tag);
    const pathsToRefresh = [
      "/returns",
      "/sales",
      "/dashboard",
      "/cashier",
      "/inventory",
      "/analytics",
      "/forecasts",
      "/search",
    ];

    for (const path of pathsToRefresh) {
      revalidatePath(path);
    }

    // Fire-and-forget low stock notification check
    checkAndCreateLowStockNotifications(profile.user.organizationId).catch(() => {});

    return { receipt };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete checkout. Please try again.",
    };
  }
}

/**
 * Retrieve the latest selling price for each product in a customer's transaction history.
 * Returns a Record<productId, lastSoldPrice> for products that have been previously
 * sold to this customer. Products with no history are omitted from the record.
 *
 * Sequential queries match the PgBouncer connection_limit=1 constraint used throughout
 * the cashier module.
 */
export async function getPreviousPricesForCustomer(
  input: GetPreviousPricesInput
): Promise<GetPreviousPricesResult> {
  let profile: Awaited<ReturnType<typeof requirePagePermission>>;

  try {
    profile = await requirePagePermission("cashier");
  } catch {
    return { error: "You do not have permission to view previous prices." };
  }

  const customerId = String(input.customerId || "").trim();
  if (!customerId) {
    return { prices: {} };
  }

  const productIds = Array.isArray(input.productIds)
    ? input.productIds.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 50)
    : [];

  if (productIds.length === 0) {
    return { prices: {} };
  }

  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const prices: Record<string, number> = {};

  for (const productId of productIds) {
    const lastItem = await db.orderItem.findFirst({
      where: {
        productId,
        salesOrder: {
          customerId,
          organizationId: profile.user.organizationId,
          deletedAt: null,
        },
      },
      orderBy: { salesOrder: { date: "desc" } },
      select: { price: true },
    });

    if (lastItem) {
      prices[productId] = toMoney(lastItem.price);
    }
  }

  return { prices };
}
