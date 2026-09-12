"use server";

import { db } from "@/lib/db";

/**
 * Fetches asset data formatted for Excel export.
 */
export async function getAssetExportData(organizationId: string) {
  const assets = await db.companyAsset.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { assetCode: "asc" },
  });

  return assets.map((a) => ({
    "Asset Code": a.assetCode,
    "Asset Name": a.assetName,
    "Category": a.category,
    "Department": a.department,
    "Condition": a.condition,
    "Status": a.status,
    "Purchase Date": a.purchaseDate ? a.purchaseDate.toLocaleDateString() : "",
    "Purchase Price": a.purchasePrice,
    "Quantity": a.quantity,
    "Assigned To": a.assignedTo || "",
    "Supplier": a.supplier || "",
    "Notes": a.notes || "",
  }));
}

/**
 * Fetches expense data formatted for Excel export.
 */
export async function getExpenseExportData(organizationId: string, dateRange?: { from?: string; to?: string }) {
  const where: any = { organizationId };
  if (dateRange?.from || dateRange?.to) {
    where.date = {};
    if (dateRange.from) where.date.gte = new Date(dateRange.from);
    if (dateRange.to) where.date.lte = new Date(dateRange.to);
  }

  const expenses = await db.expenseEntry.findMany({
    where,
    include: { project: { select: { projectName: true } } },
    orderBy: { date: "desc" },
  });

  return expenses.map((e) => ({
    "Voucher No": e.voucherNo,
    "Date": e.date.toLocaleDateString(),
    "Category": e.category.replace(/_/g, " "),
    "Description": e.description,
    "Paid To": e.paidTo || "",
    "Amount": e.amount,
    "Payment Method": e.paymentMethod,
    "Project": e.project?.projectName || "",
    "Remarks": e.remarks || "",
  }));
}

/**
 * Fetches petty cash session data formatted for Excel export.
 */
export async function getCashBookExportData(organizationId: string, dateRange?: { from?: string; to?: string }) {
  const where: any = { organizationId, paymentMethod: "CASH" };
  if (dateRange?.from || dateRange?.to) {
    where.date = {};
    if (dateRange.from) where.date.gte = new Date(dateRange.from);
    if (dateRange.to) where.date.lte = new Date(dateRange.to);
  }

  const entries = await db.expenseEntry.findMany({
    where,
    include: { project: { select: { projectName: true } } },
    orderBy: { date: "asc" },
  });

  return entries.map((e) => ({
    "Voucher No": e.voucherNo,
    "Date": e.date.toLocaleDateString(),
    "Category": e.category.replace(/_/g, " "),
    "Description": e.description,
    "Paid To": e.paidTo || "",
    "Amount": e.amount,
    "Project": e.project?.projectName || "",
  }));
}

/**
 * Fetches bank payment data formatted for Excel export.
 */
export async function getBankBookExportData(organizationId: string, dateRange?: { from?: string; to?: string }) {
  const where: any = { organizationId, paymentMethod: "BANK" };
  if (dateRange?.from || dateRange?.to) {
    where.date = {};
    if (dateRange.from) where.date.gte = new Date(dateRange.from);
    if (dateRange.to) where.date.lte = new Date(dateRange.to);
  }

  const entries = await db.expenseEntry.findMany({
    where,
    include: { project: { select: { projectName: true } } },
    orderBy: { date: "asc" },
  });

  return entries.map((e) => ({
    "Voucher No": e.voucherNo,
    "Date": e.date.toLocaleDateString(),
    "Category": e.category.replace(/_/g, " "),
    "Description": e.description,
    "Paid To": e.paidTo || "",
    "Amount": e.amount,
    "Project": e.project?.projectName || "",
  }));
}

/**
 * Fetches project data formatted for Excel export.
 */
export async function getProjectExportData(organizationId: string) {
  const projects = await db.project.findMany({
    where: { organizationId, deletedAt: null },
    include: { _count: { select: { expenses: true } } },
    orderBy: { projectCode: "asc" },
  });

  return projects.map((p) => ({
    "Project Code": p.projectCode,
    "Project Name": p.projectName,
    "Location": p.location || "",
    "Status": p.status,
    "Start Date": p.startDate ? p.startDate.toLocaleDateString() : "",
    "End Date": p.endDate ? p.endDate.toLocaleDateString() : "",
    "Estimated Budget": p.estimatedBudget,
    "Actual Cost": p.actualCost,
    "Expense Count": p._count.expenses,
  }));
}

/**
 * Fetches labour payment data formatted for Excel export.
 */
export async function getLabourRegisterExportData(organizationId: string, dateRange?: { from?: string; to?: string }) {
  const where: any = { organizationId };
  if (dateRange?.from || dateRange?.to) {
    where.date = {};
    if (dateRange.from) where.date.gte = new Date(dateRange.from);
    if (dateRange.to) where.date.lte = new Date(dateRange.to);
  }

  const payments = await db.labourPayment.findMany({
    where,
    include: { worker: { select: { workerCode: true, name: true, skill: true } } },
    orderBy: { date: "desc" },
  });

  return payments.map((p) => ({
    "Voucher No": p.voucherNo || "",
    "Date": p.date.toLocaleDateString(),
    "Worker Code": p.worker.workerCode,
    "Worker Name": p.worker.name,
    "Skill": p.worker.skill,
    "Period Start": p.periodStart.toLocaleDateString(),
    "Period End": p.periodEnd.toLocaleDateString(),
    "Days Worked": p.daysWorked,
    "Overtime Days": p.overtimeDays,
    "Total Amount": p.totalAmount,
    "Payment Method": p.paymentMethod,
    "Remarks": p.remarks || "",
  }));
}

/**
 * Fetches contractor payment data formatted for Excel export.
 */
export async function getContractorLedgerExportData(contractorId: string) {
  const contractor = await db.contractor.findUnique({
    where: { id: contractorId },
    include: {
      workOrders: {
        include: { project: { select: { projectName: true } } },
        orderBy: { createdAt: "asc" },
      },
      payments: { orderBy: { date: "asc" } },
    },
  });

  if (!contractor) return [];

  const rows: any[] = [];

  for (const wo of contractor.workOrders) {
    rows.push({
      "Type": "Work Order",
      "Date": wo.createdAt.toLocaleDateString(),
      "Description": wo.description,
      "Project": wo.project?.projectName || "",
      "Amount": wo.agreedAmount,
      "Status": wo.status,
    });
  }

  for (const p of contractor.payments) {
    rows.push({
      "Type": "Payment",
      "Date": p.date.toLocaleDateString(),
      "Description": p.remarks || "Payment",
      "Project": "",
      "Amount": -p.amount,
      "Status": p.paymentMethod,
    });
  }

  rows.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
  return rows;
}
