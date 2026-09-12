import type { ColumnMapping, ValidatedRow, ParsedRow, ImportError } from "@/lib/column-config/types";

/**
 * Validate and transform mapped rows. Detects duplicates, applies transforms, and collects errors.
 */
export function validateRows(
  rows: ParsedRow[],
  mappings: ColumnMapping[],
  existingKeys: Set<string>,
  entityType: "inventory" | "customers" | "suppliers"
): ValidatedRow[] {
  return rows.map((row) => {
    const mapped: Record<string, unknown> = {};
    const errors: ImportError[] = [];

    // Apply mappings
    for (const mapping of mappings) {
      const rawValue = row.raw[mapping.sourceColumn]?.trim() ?? "";
      const transformed = transformValue(rawValue, mapping.transform);

      if (transformed.error) {
        errors.push({
          field: mapping.targetField,
          message: transformed.error,
          suggestion: transformed.suggestion,
        });
      }

      mapped[mapping.targetField] = transformed.value;
    }

    // Validate required fields
    if (entityType === "inventory") {
      if (!mapped.name || String(mapped.name).trim() === "") {
        errors.push({ field: "name", message: "Product name is required" });
      }
    } else if (entityType === "customers") {
      if (!mapped.name || String(mapped.name).trim() === "") {
        errors.push({ field: "name", message: "Customer name is required" });
      }
    } else if (entityType === "suppliers") {
      if (!mapped.name || String(mapped.name).trim() === "") {
        errors.push({ field: "name", message: "Supplier name is required" });
      }
    }

    // Duplicate detection
    const lookupKey = entityType === "inventory"
      ? String(mapped.sku ?? "").trim()
      : String(mapped.name ?? "").trim().toLowerCase();
    const isDuplicate = lookupKey !== "" && existingKeys.has(lookupKey);

    return {
      rowIndex: row.rowIndex,
      raw: row.raw,
      mapped,
      errors,
      isDuplicate,
      action: isDuplicate ? "update" : "create",
    };
  });
}

/**
 * Transform a raw string value based on the target type.
 */
function transformValue(
  value: string,
  transform?: string
): { value: unknown; error?: string; suggestion?: string } {
  if (value === "") return { value: null };

  switch (transform) {
    case "currency": {
      // Strip currency symbols, commas, spaces
      const cleaned = value.replace(/[^\d.\-]/g, "");
      const num = parseFloat(cleaned);
      if (isNaN(num)) {
        return {
          value: null,
          error: `"${value}" is not a valid price`,
          suggestion: `Expected a number like 1250.00`,
        };
      }
      return { value: Math.abs(num) }; // Ensure positive
    }
    case "number": {
      const cleaned = value.replace(/[^\d.\-]/g, "");
      const num = parseFloat(cleaned);
      if (isNaN(num)) {
        return {
          value: null,
          error: `"${value}" is not a valid number`,
          suggestion: `Expected a number like 50`,
        };
      }
      return { value: Math.max(0, Math.round(num)) }; // Stock counts are non-negative integers
    }
    case "date": {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return {
          value: null,
          error: `"${value}" is not a valid date`,
          suggestion: "Use format YYYY-MM-DD or MM/DD/YYYY",
        };
      }
      return { value: date.toISOString() };
    }
    case "trim": {
      return { value: value.trim() };
    }
    case "uppercase": {
      return { value: value.toUpperCase().trim() };
    }
    default:
      return { value: value.trim() };
  }
}
