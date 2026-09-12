import type { EntityColumnConfig, ColumnConfig, OrgColumnConfigs, EntityType } from "./types";
import { DEFAULT_COLUMNS, BUILTIN_COLUMN_LABELS } from "./defaults";

/**
 * Resolves the effective column configuration for an entity type.
 * Merges user overrides with defaults — user config takes precedence,
 * but built-in columns always retain their core properties.
 */
export function resolveColumnConfig(
  entityType: EntityType,
  orgColumnConfigs: OrgColumnConfigs | null | undefined
): EntityColumnConfig {
  const userConfig = orgColumnConfigs?.[entityType];
  const defaults = DEFAULT_COLUMNS[entityType];

  if (!userConfig || !userConfig.columns || userConfig.columns.length === 0) {
    return defaults;
  }

  const builtinLabels = BUILTIN_COLUMN_LABELS[entityType] ?? {};

  // Build a map of user overrides by key
  const userMap = new Map<string, ColumnConfig>();
  for (const col of userConfig.columns) {
    userMap.set(col.key, col);
  }

  // Start with default columns, applying user overrides
  const resolved: ColumnConfig[] = defaults.columns.map((defaultCol) => {
    const userCol = userMap.get(defaultCol.key);
    if (!userCol) return defaultCol;

    return {
      ...defaultCol,
      visible: userCol.visible,
      order: userCol.order ?? defaultCol.order,
      width: userCol.width ?? defaultCol.width,
      label: userCol.label ?? builtinLabels[defaultCol.key] ?? defaultCol.label,
    };
  });

  // Add any custom columns from user config that aren't in defaults
  for (const [key, userCol] of userMap) {
    if (!defaults.columns.some((dc) => dc.key === key)) {
      resolved.push({
        ...userCol,
        key,
        label: userCol.label ?? key.replace("custom:", "").replace(/_/g, " "),
      });
    }
  }

  // Re-sort by order
  resolved.sort((a, b) => a.order - b.order);

  return { columns: resolved };
}

/**
 * Returns the visible columns sorted by order, suitable for rendering.
 */
export function getVisibleColumns(config: EntityColumnConfig): ColumnConfig[] {
  return config.columns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);
}

/**
 * Generates a CSS grid-template-columns string from visible columns.
 */
export function getGridTemplate(columns: ColumnConfig[]): string {
  return columns.map((col) => `${col.width}px`).join(" ");
}

/**
 * Gets the CSS grid template with fr-based responsive sizing.
 * Actions column gets "auto", everything else proportional.
 */
export function getResponsiveGridTemplate(columns: ColumnConfig[]): string {
  const parts = columns.map((col) => {
    if (col.key === "actions") return "auto";
    const fr = Math.max(1, Math.round(col.width / 100));
    return `${fr}fr`;
  });
  return parts.join(" ");
}

/**
 * Reads a value from a product's metadata or direct field.
 */
export function getCellValue(
  product: Record<string, unknown>,
  columnKey: string,
  currencyCode?: string
): { display: string; raw: unknown; align?: "left" | "center" | "right" } {
  // Computed columns
  if (columnKey.startsWith("computed:")) {
    return getComputedValue(product, columnKey, currencyCode);
  }

  // Custom columns — read from metadata
  if (columnKey.startsWith("custom:")) {
    const metaKey = columnKey.replace("custom:", "");
    const raw = (product.metadata as Record<string, unknown> | null | undefined)?.[metaKey];
    return { display: formatValue(raw, "text", currencyCode), raw, align: "left" };
  }

  // Built-in columns
  const raw = product[columnKey];
  const fieldType = getFieldType(columnKey);
  const align = ["currentStock", "costPrice", "sellingPrice", "reorderPoint", "creditLimit", "paymentTerms"].includes(columnKey)
    ? "right"
    : "left";

  return { display: formatValue(raw, fieldType, currencyCode), raw, align };
}

function getFieldType(key: string): string {
  if (["costPrice", "sellingPrice", "wholesalePrice", "creditLimit", "totalSpent"].includes(key)) return "currency";
  if (["currentStock", "reorderPoint", "leadTimeDays", "paymentTerms", "orderCount", "poCount", "productCount"].includes(key)) return "number";
  if (["expiresAt", "createdAt"].includes(key)) return "date";
  if (key === "performanceRating") return "number";
  return "text";
}

function getComputedValue(
  product: Record<string, unknown>,
  columnKey: string,
  currencyCode?: string
): { display: string; raw: unknown; align?: "left" | "center" | "right" } {
  const cost = Number(product.costPrice) || 0;
  const price = Number(product.sellingPrice) || 0;
  const stock = Number(product.currentStock) || 0;

  switch (columnKey) {
    case "computed:margin": {
      const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
      return {
        display: `${margin.toFixed(1)}%`,
        raw: margin,
        align: "right",
      };
    }
    case "computed:stock_value": {
      const val = stock * cost;
      return { display: formatValue(val, "currency", currencyCode), raw: val, align: "right" };
    }
    case "computed:potential_revenue": {
      const val = stock * price;
      return { display: formatValue(val, "currency", currencyCode), raw: val, align: "right" };
    }
    case "computed:orderCount":
    case "computed:totalSpent":
    case "computed:productCount":
    case "computed:poCount": {
      const val = product[columnKey.replace("computed:", "")];
      return { display: formatValue(val, "number", currencyCode), raw: val, align: "right" };
    }
    default:
      return { display: "—", raw: null, align: "right" };
  }
}

function formatValue(value: unknown, type: string, currencyCode?: string): string {
  if (value === null || value === undefined) return "—";

  switch (type) {
    case "currency": {
      const num = Number(value);
      if (!Number.isFinite(num)) return "—";
      const code = currencyCode || "PKR";
      try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: code, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
      } catch {
        return `${code} ${num.toFixed(2)}`;
      }
    }
    case "number": {
      const num = Number(value);
      if (!Number.isFinite(num)) return "—";
      return num.toLocaleString("en-US");
    }
    case "date": {
      if (typeof value === "string" || value instanceof Date) {
        const d = new Date(value);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      return "—";
    }
    case "boolean": {
      return value ? "✓" : "✗";
    }
    default:
      return String(value);
  }
}
