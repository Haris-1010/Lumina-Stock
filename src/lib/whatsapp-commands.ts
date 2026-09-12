/**
 * WhatsApp AI Command Processor
 *
 * Handles inbound WhatsApp messages from linked phone numbers.
 * Routes commands to the appropriate data queries and responds via WhatsApp.
 */

import { db } from "@/lib/db";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { askInventoryAssistant } from "@/lib/ai-inventory-chat";

type WaMessage = {
  from: string;
  text: string;
  orgId: string;
};

// ─── Command router ────────────────────────────────────────────────────────────

export async function handleWhatsAppCommand(msg: WaMessage): Promise<void> {
  const text = msg.text.trim().toLowerCase();

  try {
    if (matchesAny(text, ["help", "hi", "hello", "start", "menu"])) {
      return sendMenu(msg.from);
    }

    if (matchesAny(text, ["low stock", "low inventory", "reorder", "stock alert"])) {
      return sendLowStockReport(msg.from, msg.orgId);
    }

    if (matchesAny(text, ["stock report", "inventory report", "inventory summary"])) {
      return sendInventorySummary(msg.from, msg.orgId);
    }

    const invoiceMatch = text.match(/(?:send|get|show)\s+(?:invoice|bill|receipt)\s+(.+)/i);
    if (invoiceMatch) {
      return sendInvoiceInfo(msg.from, msg.orgId, invoiceMatch[1].trim());
    }

    const payslipMatch = text.match(/(?:send|get|show)\s+(?:payslip|pay slip|salary|payment)\s+(?:for\s+)?(.+)/i);
    if (payslipMatch) {
      return sendPayslipInfo(msg.from, msg.orgId, payslipMatch[1].trim());
    }

    return sendAiResponse(msg.from, msg.orgId, msg.text);
  } catch (err) {
    console.error("[WhatsApp command error]", err);
    await sendWhatsAppText(msg.from, "⚠️ Something went wrong. Please try again or visit the dashboard.");
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────────────

async function sendMenu(to: string) {
  const menu = [
    "👋 *Lumina Stock Assistant*",
    "",
    "Here's what you can ask me:",
    "",
    "📦 *low stock* — items running low",
    "📊 *inventory summary* — stock overview",
    "🧾 *send invoice [number]* — find an invoice",
    "💰 *send payslip for [invoice number]* — latest paid invoice",
    "",
    "Or just ask me anything about your inventory in plain English!",
  ].join("\n");
  await sendWhatsAppText(to, menu);
}

async function sendLowStockReport(to: string, orgId: string) {
  // Fetch all products then filter currentStock <= reorderPoint in JS
  // (Prisma doesn't support column-to-column comparisons in where)
  const products = await db.product.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { name: true, currentStock: true, sellUnit: true, reorderPoint: true },
  }).catch(() => []);

  const low = products.filter((p) => p.currentStock <= p.reorderPoint);

  if (low.length === 0) {
    await sendWhatsAppText(to, "✅ Great news! No items are below their reorder point right now.");
    return;
  }

  const lines = low
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 15)
    .map((p) => `• *${p.name}* — ${p.currentStock} ${p.sellUnit} (reorder at ${p.reorderPoint})`);

  const msg = [`⚠️ *Low Stock Report* (${low.length} item${low.length !== 1 ? "s" : ""})`, "", ...lines].join("\n");
  await sendWhatsAppText(to, msg);
}

async function sendInventorySummary(to: string, orgId: string) {
  const products = await db.product.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { currentStock: true, reorderPoint: true },
  }).catch(() => []);

  const total = products.length;
  const outOfStock = products.filter((p) => p.currentStock <= 0).length;
  const lowStock = products.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderPoint).length;

  const msg = [
    "📊 *Inventory Summary*",
    "",
    `Total Products: *${total}*`,
    `Low Stock: *${lowStock}*`,
    `Out of Stock: *${outOfStock}*`,
    "",
    "Reply *low stock* for a detailed list.",
  ].join("\n");
  await sendWhatsAppText(to, msg);
}

async function sendInvoiceInfo(to: string, orgId: string, query: string) {
  const invoice = await db.invoice.findFirst({
    where: {
      organizationId: orgId,
      deletedAt: null,
      invoiceNumber: { contains: query, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      invoiceNumber: true,
      totalAmount: true,
      status: true,
      dueDate: true,
      createdAt: true,
      currency: true,
      notes: true,
    },
  }).catch(() => null);

  if (!invoice) {
    await sendWhatsAppText(
      to,
      `❌ No invoice found matching "*${query}*".\nTry with the exact invoice number (e.g. INV-001).`,
    );
    return;
  }

  const due = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-GB") : "N/A";
  const created = new Date(invoice.createdAt).toLocaleDateString("en-GB");
  const msg = [
    `🧾 *Invoice ${invoice.invoiceNumber}*`,
    `Amount: ${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
    `Status: ${invoice.status}`,
    `Created: ${created}`,
    `Due: ${due}`,
    invoice.notes ? `Notes: ${invoice.notes}` : "",
  ].filter(Boolean).join("\n");

  await sendWhatsAppText(to, msg);
}

async function sendPayslipInfo(to: string, orgId: string, query: string) {
  // Find latest PAID invoice matching the invoice number query
  const invoice = await db.invoice.findFirst({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: "PAID",
      invoiceNumber: { contains: query, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      invoiceNumber: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      createdAt: true,
      currency: true,
    },
  }).catch(() => null);

  if (!invoice) {
    await sendWhatsAppText(
      to,
      `❌ No paid invoice found matching "*${query}*".`,
    );
    return;
  }

  const date = new Date(invoice.createdAt).toLocaleDateString("en-GB");
  const msg = [
    `💰 *Payment — Invoice ${invoice.invoiceNumber}*`,
    `Amount: ${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
    `Paid: ${invoice.currency} ${invoice.paidAmount.toFixed(2)}`,
    `Date: ${date}`,
    `Status: ${invoice.status}`,
  ].join("\n");

  await sendWhatsAppText(to, msg);
}

async function sendAiResponse(to: string, orgId: string, question: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  }).catch(() => null);

  const response = await askInventoryAssistant({
    language: "en",
    question,
    context: {
      organizationName: org?.name ?? "Your Organization",
      productCount: 0,
      revenueLast30Days: 0,
      revenueGrowthPercent30d: null,
      lowStock: [],
      outOfStock: [],
      riskForecasts: [],
      demandTrends: [],
      categoryTrends: [],
      expansionCandidates: [],
    },
    history: [],
  }).catch(() => null);

  await sendWhatsAppText(
    to,
    `🤖 ${response ?? "Sorry, I could not process that. Please try again or visit the dashboard."}`,
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}
