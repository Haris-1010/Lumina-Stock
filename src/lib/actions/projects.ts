"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { generateCode } from "@/lib/code-generators";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectFormInput {
  projectName: string;
  location?: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  estimatedBudget?: number;
}

export interface ProjectFormResult {
  success?: boolean;
  error?: string;
  projectId?: string;
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getProjectsForCurrentOrganization(filters?: {
  status?: string;
  search?: string;
}) {
  const profile = await requireActionPermission("projectsManage");

  const where: any = {
    organizationId: profile.user.organizationId,
    deletedAt: null,
  };

  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { projectName: { contains: filters.search, mode: "insensitive" } },
      { projectCode: { contains: filters.search, mode: "insensitive" } },
      { location: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.project.findMany({
    where,
    include: {
      _count: { select: { expenses: true, workOrders: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProjectDetail(projectId: string) {
  const profile = await requireActionPermission("projectsManage");

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
    include: {
      expenses: { orderBy: { date: "desc" }, take: 50 },
      workOrders: {
        include: { contractor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) return null;

  const totalExpenses = project.expenses.reduce(
    (sum, e) => sum + e.amount,
    0
  );

  return {
    ...project,
    actualCost: totalExpenses,
    variance: (project.estimatedBudget || 0) - totalExpenses,
  };
}

export async function getProjectStats(organizationId: string) {
  const [total, planning, inProgress, completed, onHold] = await Promise.all([
    db.project.count({ where: { organizationId, deletedAt: null } }),
    db.project.count({ where: { organizationId, deletedAt: null, status: "PLANNING" } }),
    db.project.count({ where: { organizationId, deletedAt: null, status: "IN_PROGRESS" } }),
    db.project.count({ where: { organizationId, deletedAt: null, status: "COMPLETED" } }),
    db.project.count({ where: { organizationId, deletedAt: null, status: "ON_HOLD" } }),
  ]);

  return { total, planning, inProgress, completed, onHold };
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export async function createProject(
  input: ProjectFormInput
): Promise<ProjectFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("projectsManage");
  } catch {
    return { error: "You do not have permission to manage projects." };
  }

  const name = input.projectName.trim();
  if (!name) return { error: "Project name is required." };
  if (name.length > 200)
    return { error: "Project name must be 200 characters or less." };

  const projectCode = await generateCode(
    profile.user.organizationId,
    "PRJ"
  );

  const project = await db.project.create({
    data: {
      organizationId: profile.user.organizationId,
      projectCode,
      projectName: name,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      status: (input.status as any) || "PLANNING",
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      estimatedBudget: Number(input.estimatedBudget) || 0,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");

  return { success: true, projectId: project.id };
}

export async function updateProject(
  projectId: string,
  input: ProjectFormInput
): Promise<ProjectFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("projectsManage");
  } catch {
    return { error: "You do not have permission to manage projects." };
  }

  const name = input.projectName.trim();
  if (!name) return { error: "Project name is required." };

  const existing = await db.project.findFirst({
    where: {
      id: projectId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Project not found." };

  await db.project.update({
    where: { id: projectId },
    data: {
      projectName: name,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      status: (input.status as any) || existing.status,
      startDate: input.startDate ? new Date(input.startDate) : existing.startDate,
      endDate: input.endDate ? new Date(input.endDate) : existing.endDate,
      estimatedBudget: Number(input.estimatedBudget) || existing.estimatedBudget,
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");

  return { success: true, projectId };
}

export async function deleteProject(
  projectId: string
): Promise<ProjectFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("projectsManage");
  } catch {
    return { error: "You do not have permission to manage projects." };
  }

  const existing = await db.project.findFirst({
    where: {
      id: projectId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Project not found." };

  await db.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");

  return { success: true };
}
