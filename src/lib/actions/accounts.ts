"use server";

import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { generateCode } from "@/lib/code-generators";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PettyCashSessionInput {
  date: string;
  receivedFrom: string;
  openingCash: number;
  remarks?: string;
}

export interface ExpenseFormInput {
  date: string;
  category: string;
  description: string;
  paidTo?: string;
  amount: number;
  paymentMethod: string;
  pettyCashId?: string;
  projectId?: string;
  remarks?: string;
  attachmentUrl?: string;
}

export interface ExpenseFormResult {
  success?: boolean;
  error?: string;
  expenseId?: string;
}

export interface PettyCashSessionResult {
  success?: boolean;
  error?: string;
  sessionId?: string;
}

// ── Petty Cash Queries ─────────────────────────────────────────────────────────

export async function getPettyCashSessions(orgId: string, dateFilter?: { from?: string; to?: string }) {
  const where: any = { organizationId: orgId };
  if (dateFilter?.from || dateFilter?.to) {
    where.date = {};
    if (dateFilter.from) where.date.gte = new Date(dateFilter.from);
    if (dateFilter.to) where.date.lte = new Date(dateFilter.to);
  }

  const sessions = await db.pettyCashEntry.findMany({
    where,
    include: {
      expenses: { select: { amount: true } },
      _count: { select: { expenses: true } },
    },
    orderBy: { date: "desc" },
  });

  return sessions.map((s) => ({
    ...s,
    totalExpenses: s.expenses.reduce((sum, e) => sum + e.amount, 0),
    remaining: s.openingCash - s.expenses.reduce((sum, e) => sum + e.amount, 0),
  }));
}

export async function getPettyCashSessionDetail(sessionId: string, orgId: string) {
  const session = await db.pettyCashEntry.findFirst({
    where: { id: sessionId, organizationId: orgId },
    include: {
      expenses: {
        orderBy: { date: "desc" },
        include: { project: { select: { projectName: true } } },
      },
    },
  });

  if (!session) return null;

  const totalExpenses = session.expenses.reduce((sum, e) => sum + e.amount, 0);
  return {
    ...session,
    totalExpenses,
    remaining: session.openingCash - totalExpenses,
  };
}

// ── Expense Queries ────────────────────────────────────────────────────────────

export async function getExpensesForCurrentOrganization(filters?: {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  paymentMethod?: string;
  search?: string;
  projectId?: string;
}) {
  const profile = await requireActionPermission("accountsManage");

  const where: any = { organizationId: profile.user.organizationId };

  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
  }
  if (filters?.category) where.category = filters.category;
  if (filters?.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters?.projectId) where.projectId = filters.projectId;
  if (filters?.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { paidTo: { contains: filters.search, mode: "insensitive" } },
      { voucherNo: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.expenseEntry.findMany({
    where,
    include: {
      project: { select: { projectName: true } },
      pettyCash: { select: { id: true, voucherNo: true } },
    },
    orderBy: { date: "desc" },
  });
}

export async function getExpensesByProject(projectId: string) {
  const profile = await requireActionPermission("accountsManage");

  return db.expenseEntry.findMany({
    where: {
      organizationId: profile.user.organizationId,
      projectId,
    },
    orderBy: { date: "desc" },
  });
}

export async function getTodayCashBalance(organizationId: string) {
  // Find the most recent petty cash session (not just today)
  const latestSession = await db.pettyCashEntry.findFirst({
    where: { organizationId },
    orderBy: { date: "desc" },
    include: { expenses: { select: { amount: true } } },
  });

  if (!latestSession) {
    return { balance: 0, totalOpening: 0, totalExpenses: 0 };
  }

  const totalOpening = latestSession.openingCash;
  const totalExpenses = latestSession.expenses.reduce((sum, e) => sum + e.amount, 0);

  return { balance: totalOpening - totalExpenses, totalOpening, totalExpenses };
}

export async function getMonthlyExpenses(organizationId: string) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await db.expenseEntry.aggregate({
    where: {
      organizationId,
      date: { gte: firstDay },
    },
    _sum: { amount: true },
  });

  return Number(result._sum.amount ?? 0);
}

// ── Petty Cash Mutations ───────────────────────────────────────────────────────

export async function createPettyCashSession(
  input: PettyCashSessionInput
): Promise<PettyCashSessionResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("accountsManage");
  } catch {
    return { error: "You do not have permission to manage accounts." };
  }

  if (!input.receivedFrom?.trim())
    return { error: "Received from is required." };
  if (Number(input.openingCash) < 0)
    return { error: "Opening cash cannot be negative." };

  const voucherNo = await generateCode(
    profile.user.organizationId,
    "VCH"
  );

  const session = await db.pettyCashEntry.create({
    data: {
      organizationId: profile.user.organizationId,
      voucherNo,
      date: new Date(input.date),
      receivedFrom: input.receivedFrom.trim(),
      openingCash: Number(input.openingCash) || 0,
      remarks: input.remarks?.trim() || null,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return { success: true, sessionId: session.id };
}

// ── Expense Mutations ──────────────────────────────────────────────────────────

export async function createExpense(
  input: ExpenseFormInput
): Promise<ExpenseFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("accountsManage");
  } catch {
    return { error: "You do not have permission to manage accounts." };
  }

  if (!input.description?.trim())
    return { error: "Description is required." };
  if (Number(input.amount) <= 0)
    return { error: "Amount must be greater than zero." };

  const voucherNo = await generateCode(
    profile.user.organizationId,
    "EXP"
  );

  const expense = await db.expenseEntry.create({
    data: {
      organizationId: profile.user.organizationId,
      pettyCashId: input.pettyCashId || null,
      projectId: input.projectId || null,
      date: new Date(input.date),
      voucherNo,
      category: input.category as any,
      description: input.description.trim(),
      paidTo: input.paidTo?.trim() || null,
      amount: Number(input.amount),
      paymentMethod: (input.paymentMethod as any) || "CASH",
      attachmentUrl: input.attachmentUrl?.trim() || null,
      remarks: input.remarks?.trim() || null,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return { success: true, expenseId: expense.id };
}

export async function updateExpense(
  expenseId: string,
  input: ExpenseFormInput
): Promise<ExpenseFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("accountsManage");
  } catch {
    return { error: "You do not have permission to manage accounts." };
  }

  const existing = await db.expenseEntry.findFirst({
    where: {
      id: expenseId,
      organizationId: profile.user.organizationId,
    },
  });
  if (!existing) return { error: "Expense not found." };

  await db.expenseEntry.update({
    where: { id: expenseId },
    data: {
      date: new Date(input.date),
      category: input.category as any,
      description: input.description.trim(),
      paidTo: input.paidTo?.trim() || null,
      amount: Number(input.amount),
      paymentMethod: (input.paymentMethod as any) || "CASH",
      pettyCashId: input.pettyCashId || null,
      projectId: input.projectId || null,
      remarks: input.remarks?.trim() || null,
      attachmentUrl: input.attachmentUrl?.trim() || null,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return { success: true, expenseId };
}

export async function deleteExpense(
  expenseId: string
): Promise<ExpenseFormResult> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("accountsManage");
  } catch {
    return { error: "You do not have permission to manage accounts." };
  }

  const existing = await db.expenseEntry.findFirst({
    where: {
      id: expenseId,
      organizationId: profile.user.organizationId,
    },
  });
  if (!existing) return { error: "Expense not found." };

  await db.expenseEntry.delete({ where: { id: expenseId } });

  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return { success: true };
}

// ── Cash Book / Bank Book ──────────────────────────────────────────────────────

export async function getCashBook(organizationId: string, dateRange?: { from?: string; to?: string }) {
  const where: any = { organizationId, paymentMethod: "CASH" };
  if (dateRange?.from || dateRange?.to) {
    where.date = {};
    if (dateRange.from) where.date.gte = new Date(dateRange.from);
    if (dateRange.to) where.date.lte = new Date(dateRange.to);
  }

  return db.expenseEntry.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      project: { select: { projectName: true } },
    },
  });
}

export async function getBankBook(organizationId: string, dateRange?: { from?: string; to?: string }) {
  const where: any = { organizationId, paymentMethod: "BANK" };
  if (dateRange?.from || dateRange?.to) {
    where.date = {};
    if (dateRange.from) where.date.gte = new Date(dateRange.from);
    if (dateRange.to) where.date.lte = new Date(dateRange.to);
  }

  return db.expenseEntry.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      project: { select: { projectName: true } },
    },
  });
}
