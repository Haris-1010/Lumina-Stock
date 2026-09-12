"use client";

import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { ColumnConfig } from "@/lib/column-config/types";

const SELECT_COLORS: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  Discontinued: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  Seasonal: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Clearance: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  New: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  Used: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Refurbished: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  Damaged: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  High: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Bronze: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  Silver: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Gold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300",
  Platinum: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEntity = Record<string, any>;

interface DynamicCellValueProps {
  /** Any entity object — product, customer, or supplier */
  entity: AnyEntity;
  /** Column configuration describing what to render */
  column: ColumnConfig;
  /** Currency code for formatting (defaults to "USD") */
  currencyCode?: string;
  /** Optional label overrides (e.g., from BUILTIN_COLUMN_LABELS) */
  labelOverrides?: Record<string, string>;
}

/**
 * Renders a cell value based on its ColumnConfig type.
 *
 * - Built-in columns: reads from entity[columnKey]
 * - Custom columns: reads from entity.metadata[customKey]
 * - Computed columns: calculates from other fields
 */
export function DynamicCellValue({ entity, column, currencyCode }: DynamicCellValueProps) {
  const { key, type } = column;

  // ── Determine value and type ──
  let value: unknown;
  let resolvedType = type;

  if (key.startsWith("computed:")) {
    // Computed values
    const result = getComputedValue(entity, key, currencyCode);
    return <span className={result.className}>{result.display}</span>;
  } else if (key.startsWith("custom:")) {
    const metaKey = key.replace("custom:", "");
    value = (entity.metadata as Record<string, unknown> | null | undefined)?.[metaKey];
    // Use column type from config for custom columns
  } else {
    value = entity[key];
    // Auto-detect type for built-in fields if not set
    if (!resolvedType) {
      resolvedType = inferType(key);
    }
  }

  // ── Render based on resolved type ──
  switch (resolvedType) {
    case "currency": {
      const num = Number(value);
      if (!Number.isFinite(num)) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
      return (
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {formatCurrency(num, currencyCode)}
        </span>
      );
    }
    case "number": {
      const num = Number(value);
      if (!Number.isFinite(num)) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
      return (
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {num.toLocaleString("en-US")}
        </span>
      );
    }
    case "date": {
      if (!value) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
      const date = new Date(value as string | Date);
      if (isNaN(date.getTime())) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
      return (
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      );
    }
    case "boolean": {
      return value ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <X className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
      );
    }
    case "select": {
      const str = String(value ?? "");
      const color = SELECT_COLORS[str] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
      return str ? (
        <Badge variant="secondary" className={`text-[10px] font-medium ${color}`}>
          {str}
        </Badge>
      ) : (
        <span className="text-zinc-300 dark:text-zinc-600">—</span>
      );
    }
    default: {
      // "text" and fallback
      const str = String(value ?? "");
      return str ? (
        <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{str}</span>
      ) : (
        <span className="text-zinc-300 dark:text-zinc-600">—</span>
      );
    }
  }
}

// ── Computed value calculator ──

function getComputedValue(
  entity: AnyEntity,
  key: string,
  currencyCode?: string
): { display: string; className: string } {
  const cost = Number(entity.costPrice) || 0;
  const price = Number(entity.sellingPrice) || 0;
  const stock = Number(entity.currentStock) || 0;

  switch (key) {
    case "computed:margin": {
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      const color = margin >= 30
        ? "text-emerald-600 dark:text-emerald-400"
        : margin >= 10
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";
      return { display: `${margin.toFixed(1)}%`, className: `text-sm font-bold ${color}` };
    }
    case "computed:stock_value": {
      const val = stock * cost;
      return {
        display: formatCurrency(val, currencyCode),
        className: "text-sm font-medium text-zinc-900 dark:text-zinc-100",
      };
    }
    case "computed:potential_revenue": {
      const val = stock * price;
      return {
        display: formatCurrency(val, currencyCode),
        className: "text-sm font-medium text-zinc-900 dark:text-zinc-100",
      };
    }
    default:
      return { display: "—", className: "text-zinc-300 dark:text-zinc-600" };
  }
}

// ── Auto-detect type for built-in fields ──

function inferType(key: string): ColumnConfig["type"] {
  if (["costPrice", "sellingPrice", "wholesalePrice", "creditLimit", "totalSpent", "mrp"].includes(key)) {
    return "currency";
  }
  if (["currentStock", "reorderPoint", "leadTimeDays", "paymentTerms", "orderCount", "poCount", "productCount", "warranty", "tax_rate", "moq"].includes(key)) {
    return "number";
  }
  if (["expiresAt", "createdAt", "manufacture_date", "last_restock_date", "warranty_expiry", "date_of_birth"].includes(key)) {
    return "date";
  }
  if (["is_hazmat", "is_fragile", "cold_chain"].includes(key)) {
    return "boolean";
  }
  return "text";
}
