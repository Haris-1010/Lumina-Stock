import { getCurrentOrganizationBranding } from "@/lib/actions/organization-settings";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Shared helper: add header block with company name + report title + date.
 */
async function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const branding = await getCurrentOrganizationBranding();
  // Top colored bar
  doc.setFillColor(30, 41, 59); // zinc-800
  doc.rect(0, 0, 210, 30, "F");

  doc.setTextColor(255, 255, 255);
  const centerLine = (text: string, y: number, size: number) => {
    doc.setFontSize(size);
    const width = doc.getTextWidth(text);
    if (width > 185) doc.setFontSize(size * 185 / width);
    doc.text(text, 105, y, { align: "center" });
  };
  doc.setFont("helvetica", "bold");
  centerLine(branding.name, 9, 16);
  doc.setFont("helvetica", "normal");
  if (branding.address) centerLine(branding.address, 16, 8);
  if (branding.phone) centerLine(branding.phone, 21, 8);
  if (subtitle) centerLine(subtitle, 27, 8);

  // Report title bar
  doc.setFillColor(241, 245, 249); // zinc-100
  doc.rect(0, 30, 210, 12, "F");

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, 105, 38, { align: "center" });
}

/**
 * Add footer with prepared by / approved by / signature lines.
 */
function addFooter(doc: jsPDF, yPos: number) {
  const footerY = Math.max(yPos + 15, 260);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(20, footerY, 190, footerY);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  doc.text("Prepared By:", 30, footerY + 10);
  doc.line(30, footerY + 12, 80, footerY + 12);

  doc.text("Approved By:", 120, footerY + 10);
  doc.line(120, footerY + 12, 170, footerY + 12);

  doc.setFont("helvetica", "normal");
  doc.text("Signature: ___________________", 30, footerY + 22);
  doc.text("Signature: ___________________", 120, footerY + 22);
}

const fmt = (n: number) => `Rs.${n.toLocaleString()}`;

// ── 1. Daily Petty Cash Report ────────────────────────────────────────────────

export interface CashReportData {
  date: string;
  sessionVoucher: string;
  receivedFrom: string;
  openingCash: number;
  expenses: {
    date: string;
    voucherNo: string;
    category: string;
    description: string;
    paidTo: string;
    amount: number;
    paymentMethod?: string;
    remarks?: string;
    project?: string;
  }[];
  visibleColumns?: string[];
}

export async function generateDailyCashReport(data: CashReportData) {
  const doc = new jsPDF();
  await addHeader(doc, "DAILY PETTY CASH REPORT", "Date: " + data.date);

  let y = 48;

  // Session info
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Voucher No: ${data.sessionVoucher}`, 20, y);
  doc.text(`Received From: ${data.receivedFrom}`, 120, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text(`Opening Cash: ${fmt(data.openingCash)}`, 20, y);
  y += 10;

  // Determine which columns to show
  const allCols = ["date", "voucherNo", "category", "description", "paidTo", "paymentMethod", "project", "remarks", "amount"];
  const colLabels: Record<string, string> = {
    date: "Date",
    voucherNo: "Voucher",
    category: "Company",
    description: "Description",
    paidTo: "Paid To",
    paymentMethod: "Method",
    project: "Project",
    remarks: "Remarks",
    amount: "Amount",
  };
  const activeCols = data.visibleColumns?.filter(c => allCols.includes(c)) ?? allCols;

  // Build rows — one cell per visible column
  // NOTE: caller is responsible for sort order — data arrives pre-sorted
  const expenseRows = data.expenses.map((e, i) => {
    const row: string[] = [String(i + 1)];
    for (const col of activeCols) {
      switch (col) {
        case "date": row.push(e.date); break;
        case "voucherNo": row.push(e.voucherNo || "-"); break;
        case "category": row.push(e.category.replace(/_/g, " ")); break;
        case "description": row.push(e.description); break;
        case "paidTo": row.push(e.paidTo || "-"); break;
        case "paymentMethod": row.push(e.paymentMethod || "-"); break;
        case "project": row.push(e.project || "-"); break;
        case "remarks": row.push(e.remarks || "-"); break;
        case "amount": row.push(fmt(e.amount)); break;
      }
    }
    return row;
  });

  const headRow = [["#", ...activeCols.map(c => colLabels[c] ?? c)]];
  const lastColIdx = activeCols.length; // index of the last column (amount=right-align)

  autoTable(doc, {
    startY: y,
    head: headRow,
    body: expenseRows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      [lastColIdx]: { halign: "right" },
    },
  });

  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  // Totals
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = data.openingCash - totalExpenses;

  y = tableEndY + 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Expenses: ${fmt(totalExpenses)}`, 120, y);
  y += 7;
  doc.setTextColor(16, 128, 64);
  doc.text(`Remaining Cash: ${fmt(remaining)}`, 120, y);

  addFooter(doc, y + 10);

  doc.save(`Daily-Cash-Report-${data.date}.pdf`);
}

// ── 2. Asset Register ─────────────────────────────────────────────────────────

export interface AssetRegisterData {
  date: string;
  assets: {
    assetCode: string;
    assetName: string;
    category: string;
    department: string;
    condition: string;
    status: string;
    purchasePrice: number;
    assignedTo?: string;
  }[];
}

export async function generateAssetRegister(data: AssetRegisterData) {
  const doc = new jsPDF();
  await addHeader(doc, "COMPANY ASSET REGISTER", `Date: ${data.date}`);

  const rows = data.assets.map((a) => [
    a.assetCode,
    a.assetName,
    a.category,
    a.department,
    a.condition,
    a.status,
    a.assignedTo || "-",
    fmt(a.purchasePrice),
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Code", "Name", "Category", "Dept", "Condition", "Status", "Assigned To", "Value"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      7: { halign: "right" },
    },
  });

  const totalValue = data.assets.reduce((sum, a) => sum + a.purchasePrice, 0);
  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 48;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Assets: ${data.assets.length}    Total Value: ${fmt(totalValue)}`, 20, tableEndY + 8);

  addFooter(doc, tableEndY + 18);

  doc.save(`Asset-Register-${data.date}.pdf`);
}

// ── 3. Project Expense Report ─────────────────────────────────────────────────

export interface ProjectExpenseReportData {
  projectName: string;
  projectCode: string;
  location: string;
  estimatedBudget: number;
  date: string;
  expenses: {
    voucherNo: string;
    date: string;
    category: string;
    description: string;
    amount: number;
  }[];
}

export async function generateProjectExpenseReport(data: ProjectExpenseReportData) {
  const doc = new jsPDF();
  await addHeader(doc, `PROJECT: ${data.projectName}`, `Code: ${data.projectCode} | Location: ${data.location}`);

  let y = 48;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Estimated Budget: ${fmt(data.estimatedBudget)}`, 20, y);
  y += 10;

  const rows = data.expenses.map((e) => [
    e.voucherNo,
    e.date,
    e.category.replace(/_/g, " "),
    e.description,
    fmt(e.amount),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Voucher", "Date", "Category", "Description", "Amount"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: { 4: { halign: "right" } },
  });

  const totalSpent = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Spent: ${fmt(totalSpent)}`, 130, tableEndY + 8);
  doc.text(`Variance: ${fmt(data.estimatedBudget - totalSpent)}`, 130, tableEndY + 16);

  addFooter(doc, tableEndY + 26);

  doc.save(`Project-Expenses-${data.projectCode}-${data.date}.pdf`);
}

// ── 4. Labour Payment Register ────────────────────────────────────────────────

export interface LabourRegisterData {
  date: string;
  dateFrom?: string;
  dateTo?: string;
  payments: {
    voucherNo: string;
    workerName: string;
    workerCode: string;
    skill: string;
    periodStart: string;
    periodEnd: string;
    daysWorked: number;
    overtimeDays: number;
    totalAmount: number;
    paymentMethod: string;
  }[];
}

export async function generateLabourPaymentRegister(data: LabourRegisterData) {
  const doc = new jsPDF();
  const subtitle = data.dateFrom
    ? `Period: ${data.dateFrom} to ${data.dateTo || "Present"}`
    : `Date: ${data.date}`;
  await addHeader(doc, "LABOUR PAYMENT REGISTER", subtitle);

  const rows = data.payments.map((p) => [
    p.voucherNo,
    p.workerCode,
    p.workerName,
    p.skill,
    `${p.periodStart} - ${p.periodEnd}`,
    String(p.daysWorked),
    String(p.overtimeDays),
    fmt(p.totalAmount),
    p.paymentMethod,
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Voucher", "Code", "Worker", "Skill", "Period", "Days", "OT", "Amount", "Method"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: { 7: { halign: "right" } },
  });

  const totalPaid = data.payments.reduce((sum, p) => sum + p.totalAmount, 0);
  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 48;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Payments: ${data.payments.length}    Total Paid: ${fmt(totalPaid)}`, 20, tableEndY + 8);

  addFooter(doc, tableEndY + 18);

  doc.save(`Labour-Payment-Register-${data.date}.pdf`);
}

// ── 5. Contractor Ledger ──────────────────────────────────────────────────────

export interface ContractorLedgerData {
  contractorName: string;
  contractorCode: string;
  date: string;
  rows: {
    type: string;
    date: string;
    description: string;
    project: string;
    amount: number;
    status: string;
  }[];
  totalAgreed: number;
  totalPaid: number;
  balance: number;
}

export async function generateContractorLedger(data: ContractorLedgerData) {
  const doc = new jsPDF();
  await addHeader(doc, `CONTRACTOR LEDGER: ${data.contractorName}`, `Code: ${data.contractorCode} | Date: ${data.date}`);

  const rows = data.rows.map((r) => [
    r.type,
    r.date,
    r.description,
    r.project || "-",
    fmt(r.amount),
    r.status,
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Type", "Date", "Description", "Project", "Amount", "Status"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: { 4: { halign: "right" } },
  });

  const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 48;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  let y = tableEndY + 8;
  doc.text(`Total Agreed: ${fmt(data.totalAgreed)}`, 20, y);
  doc.text(`Total Paid: ${fmt(data.totalPaid)}`, 100, y);
  y += 8;
  doc.setTextColor(data.balance >= 0 ? 16 : 220, data.balance >= 0 ? 128 : 38, data.balance >= 0 ? 64 : 38);
  doc.text(`Balance: ${fmt(data.balance)}`, 20, y);

  addFooter(doc, y + 10);

  doc.save(`Contractor-Ledger-${data.contractorCode}-${data.date}.pdf`);
}
