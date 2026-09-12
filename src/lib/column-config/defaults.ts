import type { EntityColumnConfig, SmartColumnDef } from "./types";

// ── Default Column Layouts ───────────────────────────────────────

export const DEFAULT_INVENTORY_COLUMNS: EntityColumnConfig = {
  columns: [
    { key: "sku", visible: true, order: 0, width: 120, label: "SKU" },
    { key: "name", visible: true, order: 1, width: 220, label: "Product" },
    { key: "category", visible: true, order: 2, width: 130, label: "Company" },
    { key: "currentStock", visible: true, order: 3, width: 100, label: "Stock" },
    { key: "costPrice", visible: true, order: 4, width: 100, label: "Cost" },
    { key: "sellingPrice", visible: true, order: 5, width: 100, label: "Price" },
    { key: "computed:margin", visible: true, order: 6, width: 80, label: "Margin", type: "computed", formula: "margin" },
    { key: "reorderPoint", visible: true, order: 7, width: 100, label: "Reorder" },
    { key: "actions", visible: true, order: 99, width: 120, label: "Actions" },
  ],
};

export const DEFAULT_CUSTOMER_COLUMNS: EntityColumnConfig = {
  columns: [
    { key: "name", visible: true, order: 0, width: 240, label: "Code / Customer" },
    { key: "address", visible: true, order: 1, width: 240, label: "Address" },
    { key: "email", visible: false, order: 7, width: 200, label: "Email" },
    { key: "phone", visible: true, order: 2, width: 140, label: "Contact number" },
    { key: "orderCount", visible: false, order: 3, width: 90, label: "Orders", type: "computed", formula: "orderCount" },
    { key: "totalSpent", visible: false, order: 4, width: 120, label: "Total Spent", type: "computed", formula: "totalSpent" },
    { key: "creditLimit", visible: false, order: 5, width: 110, label: "Credit Limit", type: "currency" },
    { key: "paymentTerms", visible: false, order: 6, width: 100, label: "Terms", type: "number" },
    { key: "actions", visible: true, order: 99, width: 100, label: "Actions" },
  ],
};

export const DEFAULT_SUPPLIER_COLUMNS: EntityColumnConfig = {
  columns: [
    { key: "name", visible: true, order: 0, width: 180, label: "Name" },
    { key: "contact", visible: true, order: 1, width: 160, label: "Contact" },
    { key: "email", visible: true, order: 2, width: 200, label: "Email" },
    { key: "productCount", visible: true, order: 3, width: 90, label: "Products", type: "computed", formula: "productCount" },
    { key: "poCount", visible: true, order: 4, width: 80, label: "POs", type: "computed", formula: "poCount" },
    { key: "actions", visible: true, order: 99, width: 120, label: "Actions" },
  ],
};

export const DEFAULT_COLUMNS: Record<string, EntityColumnConfig> = {
  inventory: DEFAULT_INVENTORY_COLUMNS,
  customers: DEFAULT_CUSTOMER_COLUMNS,
  suppliers: DEFAULT_SUPPLIER_COLUMNS,
};

// ── Built-in Column Definitions (non-removable) ──────────────────

export const BUILTIN_COLUMN_KEYS: Record<string, Set<string>> = {
  inventory: new Set(["sku", "name", "category", "currentStock", "costPrice", "sellingPrice", "computed:margin", "reorderPoint", "actions"]),
  customers: new Set(["address", "name", "email", "phone", "orderCount", "totalSpent", "creditLimit", "paymentTerms", "actions"]),
  suppliers: new Set(["name", "contact", "email", "productCount", "poCount", "actions"]),
};

// ── Built-in Column Labels ───────────────────────────────────────

export const BUILTIN_COLUMN_LABELS: Record<string, Record<string, string>> = {
  inventory: {
    sku: "SKU",
    name: "Product",
    category: "Company",
    currentStock: "Stock",
    costPrice: "Cost",
    sellingPrice: "Price",
    "computed:margin": "Margin",
    reorderPoint: "Reorder",
    leadTimeDays: "Lead Time",
    supplier: "Supplier",
    expiresAt: "Expiry",
    niche: "Niche",
    actions: "Actions",
  },
  customers: {
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    orderCount: "Orders",
    totalSpent: "Total Spent",
    creditLimit: "Credit Limit",
    paymentTerms: "Terms",
    companyName: "Company",
    taxNumber: "Tax #",
    actions: "Actions",
  },
  suppliers: {
    name: "Name",
    contact: "Contact",
    email: "Email",
    performanceRating: "Rating",
    productCount: "Products",
    poCount: "POs",
    actions: "Actions",
  },
};

// ── Smart Column Catalog ─────────────────────────────────────────

export const SMART_COLUMN_CATALOG: SmartColumnDef[] = [
  // ── Product Info ──
  {
    key: "custom:brand",
    label: "Brand",
    type: "text",
    group: "Product Info",
    description: "Product brand or manufacturer name",
  },
  {
    key: "custom:model",
    label: "Model",
    type: "text",
    group: "Product Info",
    description: "Product model number or identifier",
  },
  {
    key: "custom:barcode",
    label: "Barcode",
    type: "text",
    group: "Product Info",
    description: "UPC, EAN, or other barcode number",
  },
  {
    key: "custom:supplier_name",
    label: "Supplier Name",
    type: "text",
    group: "Product Info",
    description: "Supplier name (for display, not the linked supplier)",
  },
  {
    key: "custom:location",
    label: "Location / Bin",
    type: "text",
    group: "Product Info",
    description: "Warehouse shelf or bin location",
  },
  {
    key: "custom:warranty",
    label: "Warranty (months)",
    type: "number",
    group: "Product Info",
    description: "Warranty period in months",
  },

  // ── Measurements ──
  {
    key: "custom:weight",
    label: "Weight (kg)",
    type: "number",
    group: "Measurements",
    description: "Product weight in kilograms",
  },
  {
    key: "custom:length",
    label: "Length (cm)",
    type: "number",
    group: "Measurements",
    description: "Product length in centimeters",
  },
  {
    key: "custom:width",
    label: "Width (cm)",
    type: "number",
    group: "Measurements",
    description: "Product width in centimeters",
  },
  {
    key: "custom:height",
    label: "Height (cm)",
    type: "number",
    group: "Measurements",
    description: "Product height in centimeters",
  },

  // ── Pricing ──
  {
    key: "custom:wholesale_price",
    label: "Wholesale Price",
    type: "currency",
    group: "Pricing",
    description: "Bulk/wholesale price per unit",
  },
  {
    key: "custom:mrp",
    label: "MRP",
    type: "currency",
    group: "Pricing",
    description: "Maximum retail price",
  },
  {
    key: "custom:tax_rate",
    label: "Tax Rate (%)",
    type: "number",
    group: "Pricing",
    description: "Applicable tax percentage",
  },
  {
    key: "custom:moq",
    label: "MOQ",
    type: "number",
    group: "Pricing",
    description: "Minimum order quantity",
  },

  // ── Dates ──
  {
    key: "custom:manufacture_date",
    label: "Manufacture Date",
    type: "date",
    group: "Dates",
    description: "Date of manufacture",
  },
  {
    key: "custom:last_restock_date",
    label: "Last Restock Date",
    type: "date",
    group: "Dates",
    description: "Date of last restock",
  },
  {
    key: "custom:warranty_expiry",
    label: "Warranty Expiry",
    type: "date",
    group: "Dates",
    description: "Warranty expiration date",
  },

  // ── Flags ──
  {
    key: "custom:is_hazmat",
    label: "Is HAZMAT",
    type: "boolean",
    group: "Flags",
    description: "Hazardous material flag",
  },
  {
    key: "custom:is_fragile",
    label: "Is Fragile",
    type: "boolean",
    group: "Flags",
    description: "Fragile handling required",
  },
  {
    key: "custom:cold_chain",
    label: "Requires Cold Storage",
    type: "boolean",
    group: "Flags",
    description: "Requires temperature-controlled storage",
  },

  // ── Status ──
  {
    key: "custom:status",
    label: "Status",
    type: "select",
    group: "Status",
    options: ["Active", "Discontinued", "Seasonal", "Clearance"],
    description: "Product lifecycle status",
  },
  {
    key: "custom:condition",
    label: "Condition",
    type: "select",
    group: "Status",
    options: ["New", "Used", "Refurbished", "Damaged"],
    description: "Physical condition of the product",
  },
  {
    key: "custom:priority",
    label: "Priority",
    type: "select",
    group: "Status",
    options: ["High", "Medium", "Low"],
    description: "Inventory priority level",
  },

  // ── Computed ──
  {
    key: "computed:stock_value",
    label: "Stock Value",
    type: "computed",
    formula: "stockValue",
    group: "Computed",
    description: "currentStock × costPrice",
  },
  {
    key: "computed:potential_revenue",
    label: "Potential Revenue",
    type: "computed",
    formula: "potentialRevenue",
    group: "Computed",
    description: "currentStock × sellingPrice",
  },
];

// ── Smart columns grouped by group ───────────────────────────────

export function getSmartColumnsByGroup(): Record<string, SmartColumnDef[]> {
  const groups: Record<string, SmartColumnDef[]> = {};
  for (const col of SMART_COLUMN_CATALOG) {
    if (!groups[col.group]) groups[col.group] = [];
    groups[col.group].push(col);
  }
  return groups;
}

// ── Customer-specific smart columns ──────────────────────────────

export const CUSTOMER_SMART_COLUMNS: SmartColumnDef[] = [
  {
    key: "custom:loyalty_tier",
    label: "Loyalty Tier",
    type: "select",
    group: "Customer Info",
    options: ["Bronze", "Silver", "Gold", "Platinum"],
    description: "Customer loyalty tier",
  },
  {
    key: "custom:referral_source",
    label: "Referral Source",
    type: "select",
    group: "Customer Info",
    options: ["Walk-in", "Online", "Social Media", "Referral", "Advertisement"],
    description: "How the customer found you",
  },
  {
    key: "custom:date_of_birth",
    label: "Date of Birth",
    type: "date",
    group: "Customer Info",
    description: "Customer date of birth",
  },
  {
    key: "custom:tax_id",
    label: "Tax ID",
    type: "text",
    group: "Customer Info",
    description: "Customer tax identification number",
  },
];

// ── Supplier-specific smart columns ──────────────────────────────

export const SUPPLIER_SMART_COLUMNS: SmartColumnDef[] = [
  {
    key: "custom:lead_time_days",
    label: "Lead Time (days)",
    type: "number",
    group: "Supplier Info",
    description: "Average delivery lead time",
  },
  {
    key: "custom:payment_terms",
    label: "Payment Terms",
    type: "text",
    group: "Supplier Info",
    description: "Payment terms (e.g., Net 30)",
  },
  {
    key: "custom:minimum_order",
    label: "Minimum Order Value",
    type: "currency",
    group: "Supplier Info",
    description: "Minimum order amount required",
  },
  {
    key: "custom:rating",
    label: "Quality Rating",
    type: "select",
    group: "Supplier Info",
    options: ["★★★★★", "★★★★", "★★★", "★★", "★"],
    description: "Quality rating out of 5",
  },
];

export function getSmartColumnsForEntity(entityType: string): SmartColumnDef[] {
  switch (entityType) {
    case "customers":
      return [...SMART_COLUMN_CATALOG.filter((c) => !c.key.startsWith("computed:")), ...CUSTOMER_SMART_COLUMNS];
    case "suppliers":
      return [...SMART_COLUMN_CATALOG.filter((c) => !c.key.startsWith("computed:")), ...SUPPLIER_SMART_COLUMNS];
    default:
      return SMART_COLUMN_CATALOG;
  }
}
