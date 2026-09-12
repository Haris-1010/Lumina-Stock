"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { generateCode } from "@/lib/code-generators";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CompanyAssetFormInput {
  assetName: string;
  category: string;
  purchaseDate?: string;
  purchasePrice: number;
  quantity: number;
  department: string;
  assignedTo?: string;
  condition: string;
  supplier?: string;
  notes?: string;
}

export interface CompanyAssetFormResult {
  success?: boolean;
  error?: string;
  assetId?: string;
}

export interface AssetMovementInput {
  assetId: string;
  movementType: string;
  fromDept?: string;
  toDept?: string;
  fromPerson?: string;
  toPerson?: string;
  notes?: string;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getAssetsForCurrentOrganization(filters?: {
  status?: string;
  category?: string;
  department?: string;
  search?: string;
}) {
  const profile = await requireActionPermission("companyAssetsManage");

  const where: any = {
    organizationId: profile.user.organizationId,
    deletedAt: null,
  };

  if (filters?.status) where.status = filters.status;
  if (filters?.category) where.category = filters.category;
  if (filters?.department) where.department = filters.department;
  if (filters?.search) {
    where.OR = [
      { assetName: { contains: filters.search, mode: "insensitive" } },
      { assetCode: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.companyAsset.findMany({
    where,
    include: {
      _count: { select: { movements: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCompanyAssetDetail(assetId: string) {
  const profile = await requireActionPermission("companyAssetsManage");

  return db.companyAsset.findFirst({
    where: {
      id: assetId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
    include: {
      movements: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getAssetDashboardMetrics(organizationId: string) {
  const [totalAssets, available, issued, inRepair, totalValue] =
    await Promise.all([
      db.companyAsset.count({
        where: { organizationId, deletedAt: null },
      }),
      db.companyAsset.count({
        where: { organizationId, deletedAt: null, status: "AVAILABLE" },
      }),
      db.companyAsset.count({
        where: { organizationId, deletedAt: null, status: "ISSUED" },
      }),
      db.companyAsset.count({
        where: { organizationId, deletedAt: null, status: "IN_REPAIR" },
      }),
      db.companyAsset.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { purchasePrice: true },
      }),
    ]);

  return {
    totalAssets,
    available,
    issued,
    inRepair,
    totalValue: totalValue._sum.purchasePrice ?? 0,
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function createCompanyAsset(
  input: CompanyAssetFormInput
): Promise<CompanyAssetFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("companyAssetsManage");
  } catch {
    return { error: "You do not have permission to manage assets." };
  }

  const name = input.assetName.trim();
  if (!name) return { error: "Asset name is required." };
  if (name.length > 200) return { error: "Name must be 200 characters or less." };

  const assetCode = await generateCode(
    profile.user.organizationId,
    "AST"
  );

  const asset = await db.companyAsset.create({
    data: {
      organizationId: profile.user.organizationId,
      assetCode,
      assetName: name,
      category: input.category as any,
      purchaseDate: input.purchaseDate
        ? new Date(input.purchaseDate)
        : null,
      purchasePrice: Number(input.purchasePrice) || 0,
      quantity: Math.max(1, Math.floor(Number(input.quantity) || 1)),
      department: input.department as any,
      assignedTo: input.assignedTo?.trim() || null,
      condition: (input.condition as any) || "NEW",
      supplier: input.supplier?.trim() || null,
      status: "AVAILABLE",
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/company-assets");
  revalidatePath("/dashboard");

  return { success: true, assetId: asset.id };
}

export async function updateCompanyAsset(
  assetId: string,
  input: CompanyAssetFormInput
): Promise<CompanyAssetFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("companyAssetsManage");
  } catch {
    return { error: "You do not have permission to manage assets." };
  }

  const name = input.assetName.trim();
  if (!name) return { error: "Asset name is required." };

  const existing = await db.companyAsset.findFirst({
    where: {
      id: assetId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Asset not found." };

  await db.companyAsset.update({
    where: { id: assetId },
    data: {
      assetName: name,
      category: input.category as any,
      purchaseDate: input.purchaseDate
        ? new Date(input.purchaseDate)
        : null,
      purchasePrice: Number(input.purchasePrice) || 0,
      quantity: Math.max(1, Math.floor(Number(input.quantity) || 1)),
      department: input.department as any,
      assignedTo: input.assignedTo?.trim() || null,
      condition: (input.condition as any) || existing.condition,
      supplier: input.supplier?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/company-assets");
  revalidatePath(`/company-assets/${assetId}`);
  revalidatePath("/dashboard");

  return { success: true, assetId };
}

export async function deleteCompanyAsset(
  assetId: string
): Promise<CompanyAssetFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("companyAssetsManage");
  } catch {
    return { error: "You do not have permission to manage assets." };
  }

  const existing = await db.companyAsset.findFirst({
    where: {
      id: assetId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Asset not found." };

  await db.companyAsset.update({
    where: { id: assetId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/company-assets");
  revalidatePath("/dashboard");

  return { success: true };
}

// ── Asset Movements ────────────────────────────────────────────────────────────

export async function recordAssetMovement(
  input: AssetMovementInput
): Promise<CompanyAssetFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("companyAssetsManage");
  } catch {
    return { error: "You do not have permission to manage assets." };
  }

  const asset = await db.companyAsset.findFirst({
    where: {
      id: input.assetId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!asset) return { error: "Asset not found." };

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    AVAILABLE: ["ISSUE", "TRANSFER", "REPAIR", "SCRAP"],
    ISSUED: ["RETURN", "TRANSFER", "REPAIR", "SCRAP"],
    IN_REPAIR: ["RETURN", "SCRAP"],
  };

  if (!validTransitions[asset.status]?.includes(input.movementType)) {
    return {
      error: `Cannot perform ${input.movementType} on asset in ${asset.status} status.`,
    };
  }

  // Calculate new status
  const statusMap: Record<string, string> = {
    ISSUE: "ISSUED",
    RETURN: "AVAILABLE",
    TRANSFER: asset.status, // status doesn't change on transfer
    REPAIR: "IN_REPAIR",
    SCRAP: "SCRAPPED",
  };

  const newStatus = statusMap[input.movementType] as any;

  // Update asset fields based on movement type
  const assetUpdate: any = { status: newStatus };

  if (input.movementType === "RETURN") {
    assetUpdate.assignedTo = null;
  } else if (input.movementType === "TRANSFER" && input.toDept) {
    assetUpdate.department = input.toDept;
    if (input.toPerson) assetUpdate.assignedTo = input.toPerson;
  }

  await db.$transaction([
    db.assetMovement.create({
      data: {
        organizationId: profile.user.organizationId,
        assetId: input.assetId,
        movementType: input.movementType as any,
        fromDept: input.fromDept?.trim() || asset.department,
        toDept: input.toDept?.trim() || null,
        fromPerson: input.fromPerson?.trim() || asset.assignedTo,
        toPerson: input.toPerson?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    }),
    db.companyAsset.update({
      where: { id: input.assetId },
      data: assetUpdate,
    }),
  ]);

  revalidatePath("/company-assets");
  revalidatePath(`/company-assets/${input.assetId}`);
  revalidatePath("/dashboard");

  return { success: true, assetId: input.assetId };
}
