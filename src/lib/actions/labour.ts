"use server";

import { db } from "@/lib/db";
import { requireActionPermission, requirePagePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { generateCode } from "@/lib/code-generators";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkerFormInput {
  name: string;
  phone?: string;
  cnic?: string;
  skill?: string;
  dailyWage: number;
  status?: string;
}

export interface WorkerFormResult {
  success?: boolean;
  error?: string;
  workerId?: string;
}

export interface AttendanceFormInput {
  workerId: string;
  date: string;
  status: string;
  hoursWorked?: number;
  overtimeHours?: number;
  notes?: string;
}

export interface PaymentFormInput {
  workerId: string;
  periodStart: string;
  periodEnd: string;
  daysWorked: number;
  overtimeDays?: number;
  totalAmount: number;
  paymentMethod: string;
  remarks?: string;
}

// ── Worker Queries ─────────────────────────────────────────────────────────────

export async function getWorkersForCurrentOrganization(filters?: {
  status?: string;
  skill?: string;
  search?: string;
}) {
  const profile = await requirePagePermission("labour");

  const where: any = {
    organizationId: profile.user.organizationId,
    deletedAt: null,
  };

  if (filters?.status) where.status = filters.status;
  if (filters?.skill) where.skill = filters.skill;
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { workerCode: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.labourWorker.findMany({
    where,
    include: {
      _count: { select: { attendance: true, payments: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getWorkerDetail(workerId: string) {
  const profile = await requirePagePermission("labour");

  const worker = await db.labourWorker.findFirst({
    where: {
      id: workerId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
    include: {
      attendance: { orderBy: { date: "desc" }, take: 60 },
      payments: { orderBy: { date: "desc" } },
    },
  });

  if (!worker) return null;

  const totalPaid = worker.payments.reduce((sum, p) => sum + p.totalAmount, 0);

  return { ...worker, totalPaid };
}

export async function getLabourStats(organizationId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [totalWorkers, activeWorkers, presentToday, totalPaid] =
    await Promise.all([
      db.labourWorker.count({
        where: { organizationId, deletedAt: null },
      }),
      db.labourWorker.count({
        where: { organizationId, deletedAt: null, status: "ACTIVE" },
      }),
      db.labourAttendance.count({
        where: {
          organizationId,
          date: { gte: today, lt: tomorrow },
          status: "PRESENT",
        },
      }),
      db.labourPayment.aggregate({
        where: { organizationId },
        _sum: { totalAmount: true },
      }),
    ]);

  return {
    totalWorkers,
    activeWorkers,
    presentToday,
    totalPaid: totalPaid._sum.totalAmount ?? 0,
  };
}

// ── Worker Mutations ───────────────────────────────────────────────────────────

export async function createWorker(
  input: WorkerFormInput
): Promise<WorkerFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("labourManage");
  } catch {
    return { error: "You do not have permission to manage labour." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Worker name is required." };

  const workerCode = await generateCode(
    profile.user.organizationId,
    "LAB"
  );

  const worker = await db.labourWorker.create({
    data: {
      organizationId: profile.user.organizationId,
      workerCode,
      name,
      phone: input.phone?.trim() || null,
      cnic: input.cnic?.trim() || null,
      skill: (input.skill as any) || "LABOURER",
      dailyWage: Number(input.dailyWage) || 0,
      status: (input.status as any) || "ACTIVE",
    },
  });

  revalidatePath("/labour");
  revalidatePath("/dashboard");

  return { success: true, workerId: worker.id };
}

export async function updateWorker(
  workerId: string,
  input: WorkerFormInput
): Promise<WorkerFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("labourManage");
  } catch {
    return { error: "You do not have permission to manage labour." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Worker name is required." };

  const existing = await db.labourWorker.findFirst({
    where: {
      id: workerId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Worker not found." };

  await db.labourWorker.update({
    where: { id: workerId },
    data: {
      name,
      phone: input.phone?.trim() || null,
      cnic: input.cnic?.trim() || null,
      skill: (input.skill as any) || existing.skill,
      dailyWage: Number(input.dailyWage) || existing.dailyWage,
      status: (input.status as any) || existing.status,
    },
  });

  revalidatePath("/labour");
  revalidatePath(`/labour/${workerId}`);

  return { success: true, workerId };
}

export async function deleteWorker(
  workerId: string
): Promise<WorkerFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("labourManage");
  } catch {
    return { error: "You do not have permission to manage labour." };
  }

  const existing = await db.labourWorker.findFirst({
    where: {
      id: workerId,
      organizationId: profile.user.organizationId,
      deletedAt: null,
    },
  });
  if (!existing) return { error: "Worker not found." };

  await db.labourWorker.update({
    where: { id: workerId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/labour");
  revalidatePath("/dashboard");

  return { success: true };
}

// ── Attendance ─────────────────────────────────────────────────────────────────

export async function markBulkAttendance(entries: AttendanceFormInput[]) {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("labourManage");
  } catch {
    return { error: "You do not have permission to manage attendance." };
  }

  const orgId = profile.user.organizationId;

  for (const entry of entries) {
    const date = new Date(entry.date);
    date.setHours(0, 0, 0, 0);

    await db.labourAttendance.upsert({
      where: {
        workerId_date_organizationId: {
          workerId: entry.workerId,
          date,
          organizationId: orgId,
        },
      },
      update: {
        status: entry.status as any,
        hoursWorked: entry.hoursWorked ?? 8,
        overtimeHours: entry.overtimeHours ?? 0,
        notes: entry.notes?.trim() || null,
      },
      create: {
        organizationId: orgId,
        workerId: entry.workerId,
        date,
        status: entry.status as any,
        hoursWorked: entry.hoursWorked ?? 8,
        overtimeHours: entry.overtimeHours ?? 0,
        notes: entry.notes?.trim() || null,
      },
    });
  }

  revalidatePath("/labour");
  revalidatePath("/labour/attendance");

  return { success: true };
}

export async function getAttendanceForDate(date: string) {
  const profile = await requirePagePermission("labour");

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);

  const workers = await db.labourWorker.findMany({
    where: {
      organizationId: profile.user.organizationId,
      deletedAt: null,
      status: "ACTIVE",
    },
    orderBy: { name: "asc" },
  });

  const attendance = await db.labourAttendance.findMany({
    where: {
      organizationId: profile.user.organizationId,
      date: { gte: d, lt: next },
    },
  });

  const attMap = new Map(attendance.map((a) => [a.workerId, a]));

  return workers.map((w) => ({
    workerId: w.id,
    workerCode: w.workerCode,
    name: w.name,
    skill: w.skill,
    dailyWage: w.dailyWage,
    attendance: attMap.get(w.id) || null,
  }));
}

// ── Payments ───────────────────────────────────────────────────────────────────

export async function createPayment(
  input: PaymentFormInput
): Promise<{ success?: boolean; error?: string; paymentId?: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("labourManage");
  } catch {
    return { error: "You do not have permission to manage payments." };
  }

  if (Number(input.totalAmount) <= 0)
    return { error: "Total amount must be greater than zero." };

  const voucherNo = await generateCode(
    profile.user.organizationId,
    "WAG"
  );

  const payment = await db.labourPayment.create({
    data: {
      organizationId: profile.user.organizationId,
      workerId: input.workerId,
      date: new Date(),
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      daysWorked: Number(input.daysWorked),
      overtimeDays: Number(input.overtimeDays) || 0,
      totalAmount: Number(input.totalAmount),
      paymentMethod: input.paymentMethod,
      voucherNo,
      remarks: input.remarks?.trim() || null,
    },
  });

  revalidatePath("/labour");

  return { success: true, paymentId: payment.id };
}

export async function getPaymentRegister(
  dateFrom?: string,
  dateTo?: string
) {
  const profile = await requirePagePermission("labour");

  const where: any = {
    organizationId: profile.user.organizationId,
  };

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  return db.labourPayment.findMany({
    where,
    include: {
      worker: { select: { workerCode: true, name: true, skill: true } },
    },
    orderBy: { date: "desc" },
  });
}
