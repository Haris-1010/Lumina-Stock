import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ACTION_PERMISSION_KEYS,
  PAGE_PERMISSION_KEYS,
  PRODUCT_OWNER_GATED_PAGES,
  PRODUCT_OWNER_GATED_ACTIONS,
  type ActionPermissionKey,
  type ActionPermissionMap,
  type PagePermissionKey,
  type PagePermissionMap,
  type PermissionOverrides,
  type PermissionState,
} from "@/lib/permission-definitions";

type UserRole = "OWNER" | "ADMIN" | "MEMBER";

type PermissionIdentity = {
  id: string;
  email: string;
  role: UserRole;
  /** Tenant entitlements (Organization.featureEntitlements). Optional/defensive. */
  orgEntitlements?: unknown;
};

type UserPermissionLookupResult = { permissions: unknown } | null;

type UserPermissionLookupDelegate = {
  findUnique: (args: {
    where: { userId: string };
    select: { permissions: true };
  }) => Promise<UserPermissionLookupResult>;
};

let didWarnMissingUserPermissionDelegate = false;

function getUserPermissionLookupDelegate(): UserPermissionLookupDelegate | null {
  const delegate = (db as unknown as { userPermission?: unknown }).userPermission;

  if (
    delegate &&
    typeof (delegate as { findUnique?: unknown }).findUnique === "function"
  ) {
    return delegate as UserPermissionLookupDelegate;
  }

  if (process.env.NODE_ENV !== "production" && !didWarnMissingUserPermissionDelegate) {
    didWarnMissingUserPermissionDelegate = true;
    console.warn(
      "[permissions] Prisma delegate userPermission is unavailable. Falling back to role defaults. Restart the dev server and run `npm run db:generate` if this continues."
    );
  }

  return null;
}

function getConfiguredPlatformAdmins() {
  const raw =
    process.env.SOFTWARE_OWNER_EMAILS || process.env.ENTERPRISE_ADMIN_EMAILS || "";

  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isPlatformAdminEmail(email: string) {
  const configured = getConfiguredPlatformAdmins();
  if (configured.size === 0) return false;
  return configured.has(email.toLowerCase());
}

function toBooleanRecord<T extends readonly string[]>(
  keys: T,
  defaultValue: boolean
): Record<T[number], boolean> {
  return Object.fromEntries(keys.map((key) => [key, defaultValue])) as Record<
    T[number],
    boolean
  >;
}

function getRoleDefaultPages(role: UserRole): PagePermissionMap {
  const pages = toBooleanRecord(PAGE_PERMISSION_KEYS, false);

  pages.inventory = true;
  pages.cashier = true;
  pages.sales = true;
  pages.customers = true;
  pages.analytics = true;
  pages.forecasts = true;
  pages.invoices = true;
  pages.purchaseOrders = true;
  pages.returns = true;
  pages.search = true;
  pages.wholesaleOrders = true;
  pages.wholesaleDashboard = true;

  // Construction modules — available to all roles by default
  pages.companyAssets = true;
  pages.accounts = true;
  pages.projects = true;
  pages.labour = true;
  pages.contractors = true;

  if (role === "OWNER" || role === "ADMIN") {
    pages.recordControls = true;
    pages.settings = true;
    pages.storefront = true;
    // Product-owner-gated pages: enabled at the role level so that once the
    // product owner unlocks them for a tenant the Owner/Admin can use and
    // delegate them. They remain hard-blocked until that tenant is entitled.
    pages.adjustments = true;
    pages.marketing = true;
    pages.socialAccounts = true;
  }

  return pages;
}

function getRoleDefaultActions(role: UserRole): ActionPermissionMap {
  const actions = toBooleanRecord(ACTION_PERMISSION_KEYS, false);

  actions.aiAssistantAccess = true;
  actions.cashierCheckout = true;

  if (role === "OWNER" || role === "ADMIN") {
    actions.inventoryEdit = true;
    actions.inventoryDelete = true;
    actions.purchaseOrdersManage = true;
    actions.invoicesManage = true;
    actions.invoicesDelete = true;
    actions.invoicePaymentsManage = true;
    actions.apiKeysManage = true;
    actions.billingManage = true;
    actions.recordControlsManage = true;
    actions.csvImport = true;
    actions.webImport = true;
    actions.wholesaleOrdersManage = true;
    // Product-owner-gated; hard-blocked until the tenant is entitled.
    actions.voiceAgent = true;
    // Construction module management
    actions.companyAssetsManage = true;
    actions.accountsManage = true;
    actions.projectsManage = true;
    actions.labourManage = true;
    actions.contractorsManage = true;
  }

  if (role === "OWNER") {
    actions.managePermissions = true;
  }

  return actions;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizePermissionOverrides(input: unknown): PermissionOverrides {
  const result: PermissionOverrides = {
    pages: {},
    actions: {},
  };

  if (!isObject(input)) {
    return result;
  }

  const pagesInput = isObject(input.pages) ? input.pages : {};
  for (const key of PAGE_PERMISSION_KEYS) {
    const value = pagesInput[key];
    if (typeof value === "boolean") {
      result.pages![key] = value;
    }
  }

  const actionsInput = isObject(input.actions) ? input.actions : {};
  for (const key of ACTION_PERMISSION_KEYS) {
    const value = actionsInput[key];
    if (typeof value === "boolean") {
      result.actions![key] = value;
    }
  }

  return result;
}

function applyOverrides(
  defaults: PermissionState,
  overrides: PermissionOverrides
): PermissionState {
  const pages = { ...defaults.pages };
  const actions = { ...defaults.actions };

  for (const key of PAGE_PERMISSION_KEYS) {
    const value = overrides.pages?.[key];
    if (typeof value === "boolean") pages[key] = value;
  }

  for (const key of ACTION_PERMISSION_KEYS) {
    const value = overrides.actions?.[key];
    if (typeof value === "boolean") actions[key] = value;
  }

  return { pages, actions };
}

// Pages/actions a product owner can NEVER strip from a tenant via entitlements.
// Without these a tenant could be permanently locked out with no way back in.
const ENTITLEMENT_LIFELINE_PAGES = new Set<PagePermissionKey>(["settings"]);
const ENTITLEMENT_LIFELINE_ACTIONS = new Set<ActionPermissionKey>(["managePermissions"]);

const GATED_PAGES = new Set<PagePermissionKey>(PRODUCT_OWNER_GATED_PAGES);
const GATED_ACTIONS = new Set<ActionPermissionKey>(PRODUCT_OWNER_GATED_ACTIONS);

/**
 * Product-owner tenant entitlements act as a hard cap on top of user
 * permissions. Two regimes:
 *  - Normal keys: allowed unless the product owner explicitly set `false`.
 *  - Product-owner-gated keys: OFF for every tenant by default; only allowed
 *    when the product owner explicitly set `true` for that tenant.
 * Either way the cap can only remove access, never grant beyond user perms.
 */
function applyOrgEntitlementCap(
  state: PermissionState,
  entitlements: PermissionOverrides
): PermissionState {
  const pages = { ...state.pages };
  const actions = { ...state.actions };

  for (const key of PAGE_PERMISSION_KEYS) {
    if (ENTITLEMENT_LIFELINE_PAGES.has(key)) continue;
    if (GATED_PAGES.has(key)) {
      if (entitlements.pages?.[key] !== true) pages[key] = false;
    } else if (entitlements.pages?.[key] === false) {
      pages[key] = false;
    }
  }

  for (const key of ACTION_PERMISSION_KEYS) {
    if (ENTITLEMENT_LIFELINE_ACTIONS.has(key)) continue;
    if (GATED_ACTIONS.has(key)) {
      if (entitlements.actions?.[key] !== true) actions[key] = false;
    } else if (entitlements.actions?.[key] === false) {
      actions[key] = false;
    }
  }

  return { pages, actions };
}

function enforcePlatformBoundary(
  permissionState: PermissionState,
  isPlatformAdmin: boolean
): PermissionState {
  const pages = { ...permissionState.pages };
  const actions = { ...permissionState.actions };

  if (isPlatformAdmin) {
    pages.platformTenants = true;
    pages.platformAudit = true;
    actions.platformGovernanceManage = true;
    return { pages, actions };
  }

  pages.platformTenants = false;
  pages.platformAudit = false;
  actions.platformGovernanceManage = false;

  return { pages, actions };
}

export function getEffectivePermissions(input: {
  role: UserRole;
  email: string;
  overrides: unknown;
  /** Product-owner tenant entitlements (hard cap). Omit/null = fully entitled. */
  orgEntitlements?: unknown;
}): PermissionState {
  const defaults: PermissionState = {
    pages: getRoleDefaultPages(input.role),
    actions: getRoleDefaultActions(input.role),
  };

  const overrides = sanitizePermissionOverrides(input.overrides);
  const merged = applyOverrides(defaults, overrides);

  // Tenant entitlement cap is applied BEFORE the platform boundary so that
  // platform admins always retain platform pages regardless of tenant caps.
  const entitlements = sanitizePermissionOverrides(input.orgEntitlements);
  const capped = applyOrgEntitlementCap(merged, entitlements);

  const isPlatformAdmin = isPlatformAdminEmail(input.email);

  return enforcePlatformBoundary(capped, isPlatformAdmin);
}

export async function getEffectivePermissionsForUser(
  identity: PermissionIdentity
): Promise<PermissionState> {
  const delegate = getUserPermissionLookupDelegate();
  const row = delegate
    ? await delegate.findUnique({
        where: { userId: identity.id },
        select: { permissions: true },
      })
    : null;

  return getEffectivePermissions({
    role: identity.role,
    email: identity.email,
    overrides: row?.permissions,
    orgEntitlements: identity.orgEntitlements,
  });
}

export const getCurrentUserWithPermissions = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgEntitlements = (
    user as { organization?: { featureEntitlements?: unknown } | null }
  ).organization?.featureEntitlements;

  const permissions = await getEffectivePermissionsForUser({
    id: user.id,
    email: user.email,
    role: user.role,
    orgEntitlements,
  });

  return { user, permissions };
});

export async function canCurrentUserAccessPage(page: PagePermissionKey) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return false;
  return profile.permissions.pages[page];
}

export async function canCurrentUserPerformAction(action: ActionPermissionKey) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return false;
  return profile.permissions.actions[action];
}

export async function requireActionPermission(action: ActionPermissionKey) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    throw new Error("Not authenticated.");
  }

  if (!profile.permissions.actions[action]) {
    throw new Error("You do not have permission to perform this action.");
  }

  return profile;
}

export async function requirePagePermission(page: PagePermissionKey) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    throw new Error("Not authenticated.");
  }

  if (!profile.permissions.pages[page]) {
    throw new Error("You do not have permission to access this page.");
  }

  return profile;
}
