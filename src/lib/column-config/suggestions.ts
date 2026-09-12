import type { SmartColumnDef } from "./types";
import { SMART_COLUMN_CATALOG, CUSTOMER_SMART_COLUMNS, SUPPLIER_SMART_COLUMNS } from "./defaults";

/**
 * Returns smart column suggestions based on the organization's business type.
 * The suggestions prioritize columns most relevant to the business niche.
 */

interface BusinessTypeMapping {
  inventory: string[];
  customers: string[];
  suppliers: string[];
}

const BUSINESS_TYPE_SUGGESTIONS: Record<string, BusinessTypeMapping> = {
  RETAIL: {
    inventory: ["custom:brand", "custom:barcode", "custom:status", "custom:location", "custom:tax_rate"],
    customers: ["custom:loyalty_tier", "custom:referral_source", "custom:date_of_birth"],
    suppliers: ["custom:lead_time_days", "custom:payment_terms", "custom:rating"],
  },
  WHOLESALE: {
    inventory: ["custom:moq", "custom:wholesale_price", "custom:brand", "custom:location", "custom:tax_rate"],
    customers: ["custom:tax_id", "custom:loyalty_tier"],
    suppliers: ["custom:lead_time_days", "custom:minimum_order", "custom:payment_terms"],
  },
  CONSTRUCTION: {
    inventory: ["custom:brand", "custom:weight", "custom:location", "custom:is_fragile", "custom:status"],
    customers: ["custom:tax_id"],
    suppliers: ["custom:lead_time_days", "custom:minimum_order", "custom:rating", "custom:payment_terms"],
  },
};

export function getSmartColumnSuggestions(
  businessType: string,
  entityType: string
): SmartColumnDef[] {
  const mapping = BUSINESS_TYPE_SUGGESTIONS[businessType.toUpperCase()] ?? BUSINESS_TYPE_SUGGESTIONS.RETAIL;
  const suggestedKeys = mapping[entityType as keyof BusinessTypeMapping] ?? [];

  let catalog: SmartColumnDef[];
  switch (entityType) {
    case "customers":
      catalog = [...SMART_COLUMN_CATALOG.filter(c => !c.key.startsWith("computed:")), ...CUSTOMER_SMART_COLUMNS];
      break;
    case "suppliers":
      catalog = [...SMART_COLUMN_CATALOG.filter(c => !c.key.startsWith("computed:")), ...SUPPLIER_SMART_COLUMNS];
      break;
    default:
      catalog = SMART_COLUMN_CATALOG;
  }

  // Return suggested columns first, then the rest
  const suggested = catalog.filter(c => suggestedKeys.includes(c.key));
  const others = catalog.filter(c => !suggestedKeys.includes(c.key));

  return [...suggested, ...others];
}
