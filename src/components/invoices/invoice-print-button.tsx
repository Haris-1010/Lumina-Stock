"use client";

import { useState } from "react";
import { getCurrentOrganizationBranding } from "@/lib/actions/organization-settings";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sku?: string | null;
  productName?: string | null;
}

interface InvoiceDetails {
  id: string;
  invoiceNumber: string;
  type: string;
  status: string;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  currency: string;
  salesOrderNumber?: string | null;
  purchaseOrderNumber?: string | null;
  supplierName?: string | null;
  notes?: string | null;
  items: InvoiceItem[];
}

interface Props {
  details: InvoiceDetails;
  orgName: string;
  orgLogoUrl?: string | null;
  orgPhone?: string | null;
  orgAddress?: string | null;
  language: string;
  label: string;
}

function fmt(n: number, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function InvoicePrintButton({ details, language, label }: Props) {
  const [printError, setPrintError] = useState<string | null>(null);
  const isUr = language === "ur";

  async function handlePrint() {
    setPrintError(null);
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    let branding;
    try { branding = await getCurrentOrganizationBranding(); }
    catch {
      popup.close();
      setPrintError("Could not load store branding. Please try again.");
      return;
    }
    const { name: orgName, logoUrl: orgLogoUrl, phone: orgPhone, address: orgAddress } = branding;
    const currency = details.currency || "PKR";

    const logoHtml = orgLogoUrl
      ? `<div style="margin-bottom:16px;"><img src="${escHtml(orgLogoUrl)}" alt="${escHtml(orgName)} logo" style="max-height:72px;max-width:200px;object-fit:contain;" /></div>`
      : `<div style="width:60px;height:60px;border-radius:12px;background:linear-gradient(135deg,#10b981,#0d9488);display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
           <span style="color:white;font-size:22px;font-weight:900;">${escHtml(orgName.charAt(0).toUpperCase())}</span>
         </div>`;

    const itemRows = details.items.map((item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:11px;color:#6b7280;">${escHtml(item.sku || "—")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${escHtml(item.description)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;">${fmt(item.unitPrice, currency)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:600;">${fmt(item.lineTotal, currency)}</td>
      </tr>
    `).join("");

    const statusColor = details.status === "PAID" ? "#10b981"
      : details.status === "OVERDUE" ? "#ef4444"
      : details.status === "PARTIALLY_PAID" ? "#f59e0b"
      : "#6b7280";

    const html = `<!DOCTYPE html>
<html lang="${isUr ? "ur" : "en"}" dir="${isUr ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Invoice ${escHtml(details.invoiceNumber)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; color: #18181b; background: #fff; font-size: 13px; line-height: 1.5; }
    @page { margin: 18mm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

    .invoice-wrap { max-width: 780px; margin: 0 auto; padding: 32px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .org-section {}
    .org-name { font-size: 20px; font-weight: 800; color: #111; margin-top: 4px; }
    .org-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }

    .inv-section { text-align: right; }
    .inv-number { font-size: 28px; font-weight: 900; color: #10b981; letter-spacing: -0.5px; }
    .inv-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }

    .status-pill {
      display: inline-block; padding: 4px 12px; border-radius: 999px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      background: ${statusColor}20; color: ${statusColor}; margin-top: 8px;
    }

    .divider { border: none; border-top: 2px solid #f4f4f5; margin: 24px 0; }

    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 28px; }
    .meta-item {}
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; font-weight: 600; }
    .meta-value { font-size: 14px; font-weight: 600; color: #18181b; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #f9fafb; }
    thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }

    .totals { margin-left: auto; width: 260px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #4b5563; }
    .totals-row.total { font-weight: 800; font-size: 16px; color: #111; border-top: 2px solid #e4e4e7; padding-top: 10px; margin-top: 6px; }
    .totals-row.balance { color: ${details.balanceAmount > 0 ? "#ef4444" : "#10b981"}; font-weight: 700; }

    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #f4f4f5; display: flex; justify-content: space-between; align-items: center; }
    .footer-note { font-size: 11px; color: #9ca3af; }
    .powered { font-size: 10px; color: #d1d5db; }
  </style>
</head>
<body>
<div class="invoice-wrap">
  <div class="header">
    <div class="org-section">
      ${logoHtml}
      <div class="org-name">${escHtml(orgName)}</div>
      ${orgAddress ? `<div class="org-meta">${escHtml(orgAddress)}</div>` : ""}
      ${orgPhone ? `<div class="org-meta">${escHtml(orgPhone)}</div>` : ""}
    </div>
    <div class="inv-section">
      <div class="inv-label">Invoice</div>
      <div class="inv-number">${escHtml(details.invoiceNumber)}</div>
      <div><span class="status-pill">${escHtml(details.status)}</span></div>
    </div>
  </div>

  <hr class="divider" />

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">${isUr ? "اجراء تاریخ" : "Issue Date"}</div>
      <div class="meta-value">${fmtDate(details.issueDate)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">${isUr ? "واجب الادا تاریخ" : "Due Date"}</div>
      <div class="meta-value">${fmtDate(details.dueDate)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">${isUr ? "سپلائر / فریق" : "Supplier / Party"}</div>
      <div class="meta-value">${escHtml(details.supplierName || "—")}</div>
    </div>
    ${details.salesOrderNumber || details.purchaseOrderNumber ? `
    <div class="meta-item">
      <div class="meta-label">${isUr ? "آرڈر ریف" : "Order Ref"}</div>
      <div class="meta-value">${escHtml(details.salesOrderNumber || details.purchaseOrderNumber || "")}</div>
    </div>` : ""}
    <div class="meta-item">
      <div class="meta-label">${isUr ? "نوعیت" : "Type"}</div>
      <div class="meta-value">${escHtml(details.type)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:80px;">SKU</th>
        <th>${isUr ? "تفصیل" : "Description"}</th>
        <th style="width:60px;">${isUr ? "مقدار" : "Qty"}</th>
        <th style="width:110px;">${isUr ? "یونٹ قیمت" : "Unit Price"}</th>
        <th style="width:120px;">${isUr ? "کل" : "Total"}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row total">
      <span>${isUr ? "کل رقم" : "Total Amount"}</span>
      <span>${fmt(details.totalAmount, currency)}</span>
    </div>
    <div class="totals-row">
      <span>${isUr ? "اداشدہ" : "Amount Paid"}</span>
      <span>${fmt(details.paidAmount, currency)}</span>
    </div>
    <div class="totals-row balance">
      <span>${isUr ? "بقایا" : "Balance Due"}</span>
      <span>${fmt(details.balanceAmount, currency)}</span>
    </div>
  </div>

  ${details.notes ? `<div style="margin-top:24px;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:12px;color:#6b7280;"><strong>${isUr ? "نوٹس:" : "Notes:"}</strong> ${escHtml(details.notes)}</div>` : ""}

  <div class="footer">
    <div class="footer-note">
      ${isUr ? "یہ دستاویز خودکار طور پر تیار کی گئی ہے۔" : "This document was automatically generated."}
      ${isUr ? "تاریخ اجراء:" : "Generated on:"} ${new Date().toLocaleDateString("en-PK")}
    </div>
    <div class="powered">Powered by Lumina Stock</div>
  </div>
</div>
</body>
</html>`;

    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => { popup.print(); }, 600);
  }

  return (
    <div>
    <Button variant="outline" onClick={handlePrint} className="gap-2">
      <Printer className="h-4 w-4" />
      {label}
    </Button>
    {printError && <p role="alert" className="mt-1 text-xs text-red-600">{printError}</p>}
    </div>
  );
}
