"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { generateCode } from "@/lib/code-generators";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ContractorFormInput {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  cnic?: string;
  specialty?: string;
  address?: string;
  notes?: string;
}

export interface ContractorFormResult {
  success?: boolean;
  error?: string;
  contractorId?: string;
}

export interface WorkOrderFormInput {
  contractorId: string;
  projectId?: string;
  description: string;
  agreedAmount: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface ContractorPaymentFormInput {
  workOrderId?: string;
  contractorId: string;
  date: string;
  amount: number;
  paymentMethod: string;
  remarks?: string;
}

// ── Contractor Queries ─────────────────────────────────────────────────────────

export async function getContractorsForCurrentOrganization(filters?: {
  status?: string;
  search?: string;
}) {
  const profile = await requireActionPermission("contractorsManage");

  const where: any = {
    organizationId: profile.user.organizationId,
    deletedAt: null,
  };

  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { contractorCode: { contains: filters.search, mode: "insensitive" } },
      { companyName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.contractor.findMany({
    where,
    include: {
      _count: { select: { workOrders: true, payments: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getContractorDetail(contractorId: string) {
  const profile = await requireActionPermission("contractorsManage");

  const contractor = await db.contractor.findFirst({
    where: {
      id: contractorId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
    include: {
      workOrders: {
        include: {
          project: { select: { projectName: true } },
          payments: true,
        },
        orderBy: { createdAt: "desc" },
      },
      payments: { orderBy: { date: "desc" } },
    },
  });

  if (!contractor) return null;

  const totalAgreed = contractor.workOrders.reduce(
    (sum, wo) => sum + wo.agreedAmount,
    0
  );
  const totalPaid = contractor.payments.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  return { ...contractor, totalAgreed, totalPaid, balance: totalAgreed - totalPaid };
}

export async function getContractorStats(organizationId: string) {
  const [totalContractors, activeContractors, activeWorkOrders, totalPaid] =
    await Promise.all([
      db.contractor.count({
        where: { organizationId, deletedAt: null },
      }),
      db.contractor.count({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
      }),
      db.contractorWorkOrder.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "APPROVED", "IN_PROGRESS"] },
        },
      }),
      db.contractorPayment.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),
    ]);

  return {
    totalContractors,
    activeContractors,
    activeWorkOrders,
    totalPaid: totalPaid._sum.amount ?? 0,
  };
}

// ── Contractor Mutations ───────────────────────────────────────────────────────

export async function createContractor(
  input: ContractorFormInput
): Promise<ContractorFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("contractorsManage");
  } catch {
    return { error: "You do not have permission to manage contractors." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Contractor name is required." };

  const contractorCode = await generateCode(
    profile.user.organizationId,
    "CON"
  );

  const contractor = await db.contractor.create({
    data: {
      organizationId: profile.user.organizationId,
      contractorCode,
      name,
      companyName: input.companyName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      cnic: input.cnic?.trim() || null,
      specialty: input.specialty?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      status: "ACTIVE",
    },
  });

  revalidatePath("/contractors");
  revalidatePath("/dashboard");

  return { success: true, contractorId: contractor.id };
}

export async function updateContractor(
  contractorId: string,
  input: ContractorFormInput
): Promise<ContractorFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("contractorsManage");
  } catch {
    return { error: "You do not have permission to manage contractors." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Contractor name is required." };

  const existing = await db.contractor.findFirst({
    where: {
      id: contractorId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Contractor not found." };

  await db.contractor.update({
    where: { id: contractorId },
    data: {
      name,
      companyName: input.companyName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      cnic: input.cnic?.trim() || null,
      specialty: input.specialty?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/contractors");
  revalidatePath(`/contractors/${contractorId}`);

  return { success: true, contractorId };
}

export async function deleteContractor(
  contractorId: string
): Promise<ContractorFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("contractorsManage");
  } catch {
    return { error: "You do not have permission to manage contractors." };
  }

  const existing = await db.contractor.findFirst({
    where: {
      id: contractorId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Contractor not found." };

  await db.contractor.update({
    where: { id: contractorId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/contractors");
  revalidatePath("/dashboard");

  return { success: true };
}

// ── Work Orders ────────────────────────────────────────────────────────────────

export async function createWorkOrder(
  input: WorkOrderFormInput
): Promise<{ success?: boolean; error?: string; workOrderId?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("contractorsManage");
  } catch {
    return { error: "You do not have permission to manage work orders." };
  }

  if (!input.description?.trim())
    return { error: "Description is required." };
  if (Number(input.agreedAmount) <= 0)
    return { error: "Agreed amount must be greater than zero." };

  const workOrder = await db.contractorWorkOrder.create({
    data: {
      organizationId: profile.user.organizationId,
      contractorId: input.contractorId,
      projectId: input.projectId || null,
      description: input.description.trim(),
      agreedAmount: Number(input.agreedAmount),
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      status: (input.status as any) || "PENDING",
    },
  });

  revalidatePath("/contractors");

  return { success: true, workOrderId: workOrder.id };
}

export async function updateWorkOrderStatus(
  workOrderId: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("contractorsManage");
  } catch {
    return { error: "You do not have permission to manage work orders." };
  }

  await db.contractorWorkOrder.update({
    where: { id: workOrderId },
    data: { status: status as any },
  });

  revalidatePath("/contractors");

  return { success: true };
}

// ── Contractor Payments ────────────────────────────────────────────────────────

export async function createContractorPayment(
  input: ContractorPaymentFormInput
): Promise<{ success?: boolean; error?: string; paymentId?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("contractorsManage");
  } catch {
    return { error: "You do not have permission to record payments." };
  }

  if (Number(input.amount) <= 0)
    return { error: "Amount must be greater than zero." };

  const voucherNo = await generateCode(
    profile.user.organizationId,
    "CPT"
  );

  const payment = await db.contractorPayment.create({
    data: {
      organizationId: profile.user.organizationId,
      workOrderId: input.workOrderId || null,
      contractorId: input.contractorId,
      date: new Date(input.date),
      amount: Number(input.amount),
      paymentMethod: input.paymentMethod,
      voucherNo,
      remarks: input.remarks?.trim() || null,
    },
  });

  revalidatePath("/contractors");

  return { success: true, paymentId: payment.id };
}

export async function getContractorLedger(contractorId: string) {
  const profile = await requireActionPermission("contractorsManage");

  const contractor = await db.contractor.findFirst({
    where: {
      id: contractorId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
    include: {
      workOrders: {
        include: { project: { select: { projectName: true } } },
        orderBy: { createdAt: "asc" },
      },
      payments: { orderBy: { date: "asc" } },
    },
  });

  return contractor;
}

// ── Projects List (for work order dropdown) ────────────────────────────────────

export async function getProjectsForDropdown() {
  const profile = await requireActionPermission("contractorsManage");

  return db.project.findMany({
    where: {
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
    select: { id: true, projectCode: true, projectName: true },
    orderBy: { projectName: "asc" },
  });
}

// ── Contractors List (for work order dropdown) ─────────────────────────────────

export async function getContractorsForDropdown() {
  const profile = await requireActionPermission("contractorsManage");

  return db.contractor.findMany({
    where: {
      organizationId: profile.user.organizationId,
      deletedAt: null,
      status: "ACTIVE",
    },
    select: { id: true, contractorCode: true, name: true, companyName: true },
    orderBy: { name: "asc" },
  });
}
