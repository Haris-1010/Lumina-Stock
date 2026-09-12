import type { ColumnMapping, EntityType } from "@/lib/column-config/types";
import type { ColumnConfig } from "@/lib/column-config/types";

// ── Alias dictionary for auto-mapping ──────────────────────────────

const INVENTORY_ALIASES: Record<string, string[]> = {
  sku: ["sku", "sku code", "item code", "product code", "code", "item sku", "product sku", "barcode", "upc", "ean"],
  name: ["name", "product name", "item name", "product", "item", "description", "title", "product description"],
  category: ["company", "manufacturer", "brand", "category", "type", "group", "department", "class", "product category", "product type"],
  currentStock: ["stock", "qty", "quantity", "inventory", "units", "current stock", "available", "stock qty", "stock quantity", "on hand"],
  costPrice: ["cost", "cost price", "buy price", "purchase price", "unit cost", "landed cost", "buying price", "wholesale cost"],
  sellingPrice: ["price", "selling price", "retail price", "sell price", "mrp", "list price", "unit price", "sale price"],
  reorderPoint: ["reorder", "reorder point", "reorder level", "min stock", "minimum stock", "alert level", "reorder qty"],
  leadTimeDays: ["lead time", "lead time days", "delivery time", "days to deliver"],
  supplierId: ["supplier id", "supplier", "vendor", "vendor id", "supplier code"],
  description: ["description", "desc", "notes", "details", "product description"],
};

const CUSTOMER_ALIASES: Record<string, string[]> = {
  name: ["name", "customer name", "client name", "customer", "client", "company"],
  email: ["email", "e-mail", "mail", "contact email", "email address"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone", "contact number", "tel"],
  address: ["address", "location", "street", "city", "full address", "billing address"],
  creditLimit: ["credit", "credit limit", "credit limit amount", "max credit"],
  paymentTerms: ["payment terms", "terms", "net days", "payment days"],
  notes: ["notes", "comments", "remarks"],
};

const SUPPLIER_ALIASES: Record<string, string[]> = {
  name: ["name", "supplier name", "vendor name", "supplier", "vendor", "company"],
  contact: ["contact", "contact person", "contact name", "representative"],
  email: ["email", "e-mail", "mail", "contact email", "email address"],
};

// ── Auto-mapping engine ───────────────────────────────────────────

/**
 * Automatically maps source file headers to target entity fields.
 * Returns ColumnMapping[] with confidence-based assignments.
 */
export function autoMapColumns(
  headers: string[],
  entityType: EntityType,
  customColumns?: ColumnConfig[]
): ColumnMapping[] {
  const aliases = entityType === "inventory"
    ? INVENTORY_ALIASES
    : entityType === "customers"
      ? CUSTOMER_ALIASES
      : SUPPLIER_ALIASES;

  const mappings: ColumnMapping[] = [];

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    let targetField = "";
    let isCustom = false;

    // 1. Exact match against alias keys
    for (const [field, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(normalized)) {
        targetField = field;
        break;
      }
    }

    // 2. Fuzzy match — check if any alias is a substring of the header
    if (!targetField) {
      for (const [field, aliasList] of Object.entries(aliases)) {
        for (const alias of aliasList) {
          if (normalized.includes(alias) || alias.includes(normalized)) {
            targetField = field;
            break;
          }
        }
        if (targetField) break;
      }
    }

    // 3. Custom column match — check against custom column labels
    if (!targetField && customColumns) {
      for (const col of customColumns) {
        const colLabel = (col.label ?? col.key.replace("custom:", "")).toLowerCase();
        if (colLabel === normalized || colLabel.includes(normalized) || normalized.includes(colLabel)) {
          targetField = col.key;
          isCustom = true;
          break;
        }
      }
    }

    // 4. Transform detection
    let transform: ColumnMapping["transform"] | undefined;
    if (targetField.includes("Price") || targetField.includes("price") || targetField.includes("Cost") || targetField.includes("Spent") || targetField.includes("credit")) {
      transform = "currency";
    } else if (targetField === "currentStock" || targetField === "reorderPoint" || targetField.endsWith("Count") || targetField.includes("terms")) {
      transform = "number";
    }

    if (targetField) {
      mappings.push({
        sourceColumn: header,
        targetField,
        transform,
        isCustom,
      });
    }
  }

  return mappings;
}

/**
 * Get the full list of target fields available for a given entity type.
 */
export function getTargetFields(entityType: EntityType): { key: string; label: string; group: string }[] {
  const common = [
    { key: "actions", label: "Actions", group: "System" },
  ];

  switch (entityType) {
    case "inventory":
      return [
        { key: "sku", label: "SKU", group: "Product" },
        { key: "name", label: "Product Name", group: "Product" },
        { key: "description", label: "Description", group: "Product" },
        { key: "category", label: "Company", group: "Product" },
        { key: "currentStock", label: "Stock Quantity", group: "Stock" },
        { key: "reorderPoint", label: "Reorder Point", group: "Stock" },
        { key: "costPrice", label: "Cost Price", group: "Pricing" },
        { key: "sellingPrice", label: "Selling Price", group: "Pricing" },
        { key: "leadTimeDays", label: "Lead Time (days)", group: "Supply" },
        { key: "expiresAt", label: "Expiry Date", group: "Dates" },
        ...common,
      ];
    case "customers":
      return [
        { key: "name", label: "Customer Name", group: "Contact" },
        { key: "email", label: "Email", group: "Contact" },
        { key: "phone", label: "Phone", group: "Contact" },
        { key: "address", label: "Address", group: "Contact" },
        { key: "creditLimit", label: "Credit Limit", group: "Financial" },
        { key: "paymentTerms", label: "Payment Terms", group: "Financial" },
        { key: "notes", label: "Notes", group: "Other" },
        ...common,
      ];
    case "suppliers":
      return [
        { key: "name", label: "Supplier Name", group: "Contact" },
        { key: "contact", label: "Contact Person", group: "Contact" },
        { key: "email", label: "Email", group: "Contact" },
        ...common,
      ];
    default:
      return common;
  }
}
