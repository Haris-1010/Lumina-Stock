export const PAGE_PERMISSION_KEYS = [
  "inventory",
  "cashier",
  "sales",
  "customers",
  "analytics",
  "forecasts",
  "invoices",
  "purchaseOrders",
  "adjustments",
  "returns",
  "recordControls",
  "search",
  "settings",
  "platformTenants",
  "platformAudit",
  "storefront",
  "wholesaleOrders",
  "wholesaleDashboard",
  "marketing",
  "socialAccounts",
  "companyAssets",
  "accounts",
  "projects",
  "labour",
  "contractors",
] as const;

export const ACTION_PERMISSION_KEYS = [
  "inventoryEdit",
  "inventoryDelete",
  "cashierCheckout",
  "purchaseOrdersManage",
  "invoicesManage",
  "invoicesDelete",
  "invoicePaymentsManage",
  "apiKeysManage",
  "billingManage",
  "recordControlsManage",
  "csvImport",
  "webImport",
  "managePermissions",
  "platformGovernanceManage",
  "aiAssistantAccess",
  "wholesaleOrdersManage",
  "voiceAgent",
  "companyAssetsManage",
  "accountsManage",
  "projectsManage",
  "labourManage",
  "contractorsManage",
] as const;

/**
 * Pages/actions that are OFF for every tenant by default and can ONLY be
 * enabled by the product owner per-tenant (Platform → Tenants → Feature Access).
 */
export const PRODUCT_OWNER_GATED_PAGES = [
  "adjustments",
  "marketing",
  "socialAccounts",
] as const;

export const PRODUCT_OWNER_GATED_ACTIONS = [
  "voiceAgent",
] as const;

export type PagePermissionKey = (typeof PAGE_PERMISSION_KEYS)[number];
export type ActionPermissionKey = (typeof ACTION_PERMISSION_KEYS)[number];

export type PagePermissionMap = Record<PagePermissionKey, boolean>;
export type ActionPermissionMap = Record<ActionPermissionKey, boolean>;

export interface PermissionState {
  pages: PagePermissionMap;
  actions: ActionPermissionMap;
}

export interface PermissionOverrides {
  pages?: Partial<PagePermissionMap>;
  actions?: Partial<ActionPermissionMap>;
}

export const PAGE_PERMISSION_LABELS: Record<PagePermissionKey, string> = {
  inventory: "Inventory Page",
  cashier: "Cashier Page",
  sales: "Sales History Page",
  customers: "Customers Page",
  analytics: "Analytics Page",
  forecasts: "Forecasts Page",
  invoices: "Invoices Page",
  purchaseOrders: "Purchase Orders Page",
  adjustments: "Stock Adjustments Page",
  returns: "Returns Page",
  recordControls: "Record Controls Page",
  search: "Search Page",
  settings: "Settings Page",
  platformTenants: "Platform Tenant Controls",
  platformAudit: "Platform Audit Page",
  storefront: "Storefront Builder Page",
  wholesaleOrders: "Wholesale Orders Page",
  wholesaleDashboard: "Wholesale Dashboard Page",
  marketing: "Marketing Page",
  socialAccounts: "Social Accounts Page",
  companyAssets: "Company Assets Page",
  accounts: "Accounts & Petty Cash Page",
  projects: "Projects Page",
  labour: "Labour Management Page",
  contractors: "Contractor Management Page",
};

export const ACTION_PERMISSION_LABELS: Record<ActionPermissionKey, string> = {
  inventoryEdit: "Create/Update Inventory",
  inventoryDelete: "Delete Inventory Items",
  cashierCheckout: "Complete Cashier Sales",
  purchaseOrdersManage: "Manage Purchase Orders",
  invoicesManage: "Create/Update Invoices",
  invoicesDelete: "Delete Invoices",
  invoicePaymentsManage: "Process Invoice Payments",
  apiKeysManage: "Manage API Keys",
  billingManage: "Manage Billing",
  recordControlsManage: "Use Record Controls",
  csvImport: "CSV Import",
  webImport: "Website Auto Import",
  managePermissions: "Manage Employee Permissions",
  platformGovernanceManage: "Platform Governance Actions",
  aiAssistantAccess: "Use AI Assistant",
  wholesaleOrdersManage: "Manage Wholesale Orders",
  voiceAgent: "Voice Agent (Hey Lumina)",
  companyAssetsManage: "Manage Company Assets",
  accountsManage: "Manage Accounts & Expenses",
  projectsManage: "Manage Projects",
  labourManage: "Manage Labour & Attendance",
  contractorsManage: "Manage Contractors",
};
