"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  ACTION_PERMISSION_KEYS,
  PAGE_PERMISSION_KEYS,
  type ActionPermissionMap,
  type PagePermissionMap,
  type PermissionState,
} from "@/lib/permission-definitions";
import {
  getCurrentUserWithPermissions,
  getEffectivePermissions,
  requireActionPermission,
} from "@/lib/permissions";

type UserRole = "OWNER" | "ADMIN" | "MEMBER";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];
type InputJsonValue = JsonValue;

export interface PermissionSettingsUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: PermissionState;
}

export interface PermissionSettingsData {
  actorUserId: string | null;
  canManagePermissions: boolean;
  users: PermissionSettingsUser[];
}

const ROLE_WEIGHT: Record<UserRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

type UserPermissionFindManyArgs = {
  where?: { organizationId?: string };
  select?: { userId?: boolean; permissions?: boolean };
};

type UserPermissionUpsertArgs = {
  where: { userId: string };
  update: { organizationId: string; permissions: InputJsonValue };
  create: { userId: string; organizationId: string; permissions: InputJsonValue };
};

type UserPermissionDelegate = {
  findMany: (args: UserPermissionFindManyArgs) => Promise<Array<{
    userId: string;
    permissions: JsonValue;
  }>>;
  upsert: (args: UserPermissionUpsertArgs) => Promise<unknown>;
};

let didWarnMissingUserPermissionDelegate = false;

function getUserPermissionDelegate(): UserPermissionDelegate | null {
  const delegate = (db as unknown as { userPermission?: unknown }).userPermission;

  if (
    delegate &&
    typeof (delegate as { findMany?: unknown }).findMany === "function" &&
    typeof (delegate as { upsert?: unknown }).upsert === "function"
  ) {
    return delegate as UserPermissionDelegate;
  }

  if (process.env.NODE_ENV !== "production" && !didWarnMissingUserPermissionDelegate) {
    didWarnMissingUserPermissionDelegate = true;
    console.warn(
      "[permissions-actions] Prisma delegate userPermission is unavailable. Permission overrides are temporarily disabled. Restart dev server and run npm run db:generate if needed."
    );
  }

  return null;
}

function sanitizePermissionMapInput<K extends string>(
  keys: readonly K[],
  input: unknown
): Record<K, boolean> {
  const result = {} as Record<K, boolean>;

  for (const key of keys) {
    result[key] = false;
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return result;
  }

  const values = input as Record<string, unknown>;
  for (const key of keys) {
    const value = values[key];
    if (typeof value === "boolean") {
      result[key] = value;
    }
  }

  return result;
}

function sanitizePermissionStateInput(input: unknown): PermissionState {
  const pages = sanitizePermissionMapInput(
    PAGE_PERMISSION_KEYS,
    (input as { pages?: unknown } | null | undefined)?.pages
  ) as PagePermissionMap;

  const actions = sanitizePermissionMapInput(
    ACTION_PERMISSION_KEYS,
    (input as { actions?: unknown } | null | undefined)?.actions
  ) as ActionPermissionMap;

  return { pages, actions };
}

export async function getPermissionSettingsForCurrentOrganization(): Promise<PermissionSettingsData> {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) {
    return {
      actorUserId: null,
      canManagePermissions: false,
      users: [],
    };
  }

  const canManagePermissions = profile.permissions.actions.managePermissions;
  if (!canManagePermissions) {
    return {
      actorUserId: profile.user.id,
      canManagePermissions: false,
      users: [],
    };
  }

  const permissionDelegate = getUserPermissionDelegate();

  const [users, permissionRows] = await Promise.all([
    db.user.findMany({
      where: { organizationId: profile.user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    permissionDelegate
      ? permissionDelegate.findMany({
          where: { organizationId: profile.user.organizationId },
          select: {
            userId: true,
            permissions: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const permissionByUserId = new Map(
    permissionRows.map((row) => [row.userId, row.permissions])
  );

  const mappedUsers: PermissionSettingsUser[] = users
    .map((user: { id: string; name: string; email: string; role: UserRole }) => {
      const permissions = getEffectivePermissions({
        role: user.role,
        email: user.email,
        overrides: permissionByUserId.get(user.id),
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      };
    })
    .sort((left: PermissionSettingsUser, right: PermissionSettingsUser) => {
      if (ROLE_WEIGHT[left.role] !== ROLE_WEIGHT[right.role]) {
        return ROLE_WEIGHT[left.role] - ROLE_WEIGHT[right.role];
      }

      return left.name.localeCompare(right.name);
    });

  return {
    actorUserId: profile.user.id,
    canManagePermissions: true,
    users: mappedUsers,
  };
}

export async function updateUserPermissionsForCurrentOrganization(input: {
  userId: string;
  permissions: PermissionState;
}) {
  const profile = await requireActionPermission("managePermissions");
  const permissionDelegate = getUserPermissionDelegate();

  if (!permissionDelegate) {
    return {
      error:
        "Permission storage is temporarily unavailable. Restart the server and rerun Prisma generate.",
    };
  }

  const userId = input.userId.trim();
  if (!userId) {
    return { error: "User is required." };
  }

  const targetUser = await db.user.findFirst({
    where: {
      id: userId,
      organizationId: profile.user.organizationId,
    },
    select: {
      id: true,
      role: true,
      email: true,
    },
  });

  if (!targetUser) {
    return { error: "Selected employee was not found." };
  }

  const sanitized = sanitizePermissionStateInput(input.permissions);

  // Prevent accidental lockout of owner-level permission administration.
  if (targetUser.role === "OWNER" || targetUser.id === profile.user.id) {
    sanitized.actions.managePermissions = true;
    sanitized.pages.settings = true;
  }

  const effective = getEffectivePermissions({
    role: targetUser.role,
    email: targetUser.email,
    overrides: sanitized,
  });
  const permissionsJson = effective as unknown as InputJsonValue;

  await permissionDelegate.upsert({
    where: { userId: targetUser.id },
    update: {
      organizationId: profile.user.organizationId,
      permissions: permissionsJson,
    },
    create: {
      userId: targetUser.id,
      organizationId: profile.user.organizationId,
      permissions: permissionsJson,
    },
  });

  const pathsToRefresh = [
    "/dashboard",
    "/inventory",
    "/cashier",
    "/analytics",
    "/forecasts",
    "/invoices",
    "/purchase-orders",
    "/record-controls",
    "/search",
    "/settings",
    "/platform/tenants",
    "/platform/audit",
  ];

  for (const path of pathsToRefresh) {
    revalidatePath(path);
  }

  return { success: true };
}

function validateEmployeePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  return null;
}

export async function createEmployeeForCurrentOrganization(input: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "MEMBER";
}): Promise<{ success: true; user: PermissionSettingsUser } | { error: string }> {
  const profile = await requireActionPermission("managePermissions");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const role: UserRole = input.role === "ADMIN" ? "ADMIN" : "MEMBER";

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const passwordError = validateEmployeePassword(password);
  if (passwordError) return { error: passwordError };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      organizationId: profile.user.organizationId,
    },
  });

  const permissions = getEffectivePermissions({
    role: newUser.role as UserRole,
    email: newUser.email,
    overrides: null,
  });

  revalidatePath("/settings");

  return {
    success: true,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role as UserRole,
      permissions,
    },
  };
}

export async function deleteEmployeeFromCurrentOrganization(input: {
  userId: string;
}): Promise<{ success: true } | { error: string }> {
  const profile = await requireActionPermission("managePermissions");

  const userId = input.userId.trim();

  if (userId === profile.user.id) {
    return { error: "You cannot delete your own account." };
  }

  const targetUser = await db.user.findFirst({
    where: { id: userId, organizationId: profile.user.organizationId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    return { error: "Employee not found." };
  }

  if (targetUser.role === "OWNER") {
    return { error: "Owner accounts cannot be removed." };
  }

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/settings");

  return { success: true };
}
