"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, ExternalLink, Search, Trash2, ReceiptText, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvoiceListItem } from "@/types";
import type { SupportedInvoiceGateway } from "@/lib/invoice-gateways";
import { deleteInvoiceForCurrentOrganization } from "@/lib/actions/invoices";

type GatewayState = Record<string, SupportedInvoiceGateway>;

interface DeleteInvoiceResult {
  success?: boolean;
  invoiceNumber?: string;
  error?: string;
}

function invoiceStatusBadge(status: InvoiceListItem["status"], language: "en" | "ur") {
  const urduLabels: Record<InvoiceListItem["status"], string> = {
    DRAFT: "ڈرافٹ",
    ISSUED: "جاری شدہ",
    PARTIALLY_PAID: "جزوی ادا",
    PAID: "ادا شدہ",
    OVERDUE: "بقایاجات",
    CANCELLED: "منسوخ",
  };

  const label = language === "ur" ? urduLabels[status] : status.replaceAll("_", " ");

  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
  if (status === "PAID")         return <span className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300`}>{label}</span>;
  if (status === "OVERDUE")      return <span className={`${base} bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300`}>{label}</span>;
  if (status === "PARTIALLY_PAID") return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300`}>{label}</span>;
  if (status === "CANCELLED")    return <span className={`${base} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`}>{label}</span>;
  if (status === "ISSUED")       return <span className={`${base} bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300`}>{label}</span>;
  return <span className={`${base} bg-zinc-100 text-zinc-500 dark:bg-zinc-800`}>{label}</span>;
}

export function InvoicesClient({
  invoices,
  canDeleteInvoices,
  canManageInvoicePayments,
}: {
  invoices: InvoiceListItem[];
  canDeleteInvoices: boolean;
  canManageInvoicePayments: boolean;
}) {
  const { language } = useI18n();
  const [localInvoices, setLocalInvoices] = useState<InvoiceListItem[]>(invoices);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "SALES" | "PURCHASE">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceListItem["status"]>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [gatewayByInvoice, setGatewayByInvoice] = useState<GatewayState>({});
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [pendingDeleteInvoiceId, setPendingDeleteInvoiceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const labels = language === "ur"
    ? {
        search: "انوائس نمبر، سپلائر یا آرڈر سے تلاش کریں",
        allTypes: "تمام اقسام",
        sales: "سیلز",
        purchase: "پرچیز",
        allStatus: "تمام اسٹیٹس",
        details: "تفصیل",
        download: "ڈاؤن لوڈ",
        payNow: "ابھی ادا کریں",
        orderRef: "آرڈر",
        supplier: "سپلائر",
        noData: "کوئی انوائس موجود نہیں۔",
        actions: "اقدامات",
        delete: "حذف",
        deleteTitle: "انوائس حذف کریں",
        deleteDescription: "یہ انوائس مستقل طور پر حذف ہو جائے گی۔",
        deleteWarning: "جزوی یا مکمل ادا شدہ انوائس حذف نہیں کی جا سکتی۔",
        cancel: "منسوخ",
        confirmDelete: "حذف کریں",
        deleted: (invoiceNumber: string) => `${invoiceNumber} حذف کر دی گئی۔`,
      }
    : {
        search: "Search by invoice number, supplier or order",
        allTypes: "All Types",
        sales: "Sales",
        purchase: "Purchase",
        allStatus: "All Status",
        details: "Details",
        download: "Download",
        payNow: "Pay Now",
        orderRef: "Order",
        supplier: "Supplier",
        noData: "No invoices found.",
        actions: "Actions",
        delete: "Delete",
        deleteTitle: "Delete Invoice",
        deleteDescription: "This invoice will be permanently deleted.",
        deleteWarning: "Partially or fully paid invoices cannot be deleted.",
        cancel: "Cancel",
        confirmDelete: "Delete",
        deleted: (invoiceNumber: string) => `${invoiceNumber} has been deleted.`,
      };

  const pendingDeleteInvoice = localInvoices.find((invoice) => invoice.id === pendingDeleteInvoiceId) || null;

  const filteredInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return localInvoices.filter((invoice) => {
      const queryMatch =
        normalized.length === 0 ||
        invoice.invoiceNumber.toLowerCase().includes(normalized) ||
        (invoice.salesOrderNumber || "").toLowerCase().includes(normalized) ||
        (invoice.purchaseOrderNumber || "").toLowerCase().includes(normalized) ||
        (invoice.supplierName || "").toLowerCase().includes(normalized);

      const typeMatch = typeFilter === "ALL" || invoice.type === typeFilter;
      const statusMatch = statusFilter === "ALL" || invoice.status === statusFilter;

      return queryMatch && typeMatch && statusMatch;
    });
  }, [localInvoices, query, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedInvoices = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, safePage, pageSize]);

  async function handleCheckout(invoiceId: string) {
    try {
      setLoadingInvoiceId(invoiceId);
      const gateway = gatewayByInvoice[invoiceId] || "STRIPE";

      const response = await fetch(`/api/invoices/${invoiceId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway }),
      });

      const payload = (await response.json()) as {
        checkoutUrl?: string;
        checkoutMethod?: "GET" | "POST";
        postFields?: Record<string, string> | null;
        error?: string;
      };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Unable to start checkout.");
      }

      if (payload.checkoutMethod === "POST" && payload.postFields) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = payload.checkoutUrl;
        form.style.display = "none";

        for (const [key, value] of Object.entries(payload.postFields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
        return;
      }

      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed.";
      window.alert(message);
      setLoadingInvoiceId(null);
    }
  }

  function handleDeleteInvoice() {
    if (!pendingDeleteInvoiceId) return;
    setFeedback(null);

    startTransition(async () => {
      const result = (await deleteInvoiceForCurrentOrganization(
        pendingDeleteInvoiceId
      )) as DeleteInvoiceResult;

      if (result?.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      const removedInvoice = localInvoices.find((invoice) => invoice.id === pendingDeleteInvoiceId);

      setLocalInvoices((prev) => prev.filter((invoice) => invoice.id !== pendingDeleteInvoiceId));
      setPendingDeleteInvoiceId(null);
      setFeedback({
        type: "success",
        message: labels.deleted(removedInvoice?.invoiceNumber || "Invoice"),
      });
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={labels.search}
            className="pl-9 rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as typeof typeFilter); setPage(1); }}>
            <SelectTrigger className="h-9 w-[140px] rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 text-sm">
              <SelectValue placeholder={labels.allTypes} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL">{labels.allTypes}</SelectItem>
              <SelectItem value="SALES">{labels.sales}</SelectItem>
              <SelectItem value="PURCHASE">{labels.purchase}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px] rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 text-sm">
              <SelectValue placeholder={labels.allStatus} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL">{labels.allStatus}</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ISSUED">Issued</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Feedback ─────────────────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
          feedback.type === "error"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}>
          {feedback.message}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-zinc-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Invoices</span>
          </div>
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {filteredInvoices.length}{filteredInvoices.length !== localInvoices.length ? ` / ${localInvoices.length}` : ""}
          </span>
        </div>

        {/* Mobile: stacked cards */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {paginatedInvoices.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">{labels.noData}</div>
          ) : (
            paginatedInvoices.map((invoice) => {
              const canPay = canManageInvoicePayments && invoice.balanceAmount > 0 && invoice.status !== "CANCELLED";
              const canDelete = canDeleteInvoices && invoice.paidAmount <= 0 && invoice.status !== "PAID" && invoice.status !== "PARTIALLY_PAID";
              return (
                <div key={invoice.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/invoices/${invoice.id}`} className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="truncate text-[11px] text-zinc-400">
                        {invoice.type}
                        {(invoice.supplierName || invoice.salesOrderNumber || invoice.purchaseOrderNumber)
                          ? ` · ${invoice.supplierName || invoice.salesOrderNumber || invoice.purchaseOrderNumber}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0">{invoiceStatusBadge(invoice.status, language)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-2 text-xs">
                    <div><p className="text-zinc-400">Total</p><p className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(invoice.totalAmount)}</p></div>
                    <div><p className="text-zinc-400">Paid</p><p className="text-emerald-600 dark:text-emerald-400">{formatCurrency(invoice.paidAmount)}</p></div>
                    <div className="text-right"><p className="text-zinc-400">Balance</p><p className={`font-bold ${invoice.balanceAmount > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-400"}`}>{formatCurrency(invoice.balanceAmount)}</p></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Issued {formatDate(invoice.issueDate)}</span>
                    {invoice.dueDate && (
                      <span className={invoice.status === "OVERDUE" ? "font-semibold text-red-600" : ""}>Due {formatDate(invoice.dueDate)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link href={`/invoices/${invoice.id}`} className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <ExternalLink className="h-3 w-3" />View
                    </Link>
                    <a href={`/api/invoices/${invoice.id}/download`} className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <Download className="h-3 w-3" />PDF
                    </a>
                    {canPay && (
                      <button onClick={() => handleCheckout(invoice.id)} disabled={loadingInvoiceId === invoice.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 disabled:opacity-40">
                        {loadingInvoiceId === invoice.id ? "…" : labels.payNow}
                      </button>
                    )}
                    {canDeleteInvoices && (
                      <button onClick={() => { setFeedback(null); setPendingDeleteInvoiceId(invoice.id); }} disabled={!canDelete || isPending} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 disabled:opacity-30">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
        <div className="min-w-[900px]">
        {/* Column headers */}
        <div className="grid grid-cols-[1.4fr_90px_130px_110px_110px_100px_100px_110px] px-5 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
          {["Invoice", "Type", "Status", "Issue Date", "Due Date", "Total", "Paid", "Balance"].map((h, i) => (
            <span key={i} className={`text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${i >= 5 ? "text-right" : ""}`}>{h}</span>
          ))}
        </div>

        {paginatedInvoices.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">{labels.noData}</div>
        ) : (
          paginatedInvoices.map((invoice) => {
            const selectedGateway = gatewayByInvoice[invoice.id] || "STRIPE";
            const canPay = canManageInvoicePayments && invoice.balanceAmount > 0 && invoice.status !== "CANCELLED";
            const canDelete = canDeleteInvoices && invoice.paidAmount <= 0 && invoice.status !== "PAID" && invoice.status !== "PARTIALLY_PAID";

            return (
              <div
                key={invoice.id}
                className="group relative grid grid-cols-[1.4fr_90px_130px_110px_110px_100px_100px_110px] items-center px-5 py-3 border-b border-zinc-100/60 dark:border-zinc-800/40 last:border-0 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
              >
                {/* Invoice number */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <ReceiptText className="h-3.5 w-3.5 text-zinc-500" />
                  </div>
                  <div className="min-w-0">
                    <Link href={`/invoices/${invoice.id}`} className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate block">
                      {invoice.invoiceNumber}
                    </Link>
                    {(invoice.supplierName || invoice.salesOrderNumber || invoice.purchaseOrderNumber) && (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate block">
                        {invoice.supplierName || invoice.salesOrderNumber || invoice.purchaseOrderNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Type */}
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{invoice.type}</span>

                {/* Status */}
                <div>{invoiceStatusBadge(invoice.status, language)}</div>

                {/* Issue date */}
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{formatDate(invoice.issueDate)}</span>

                {/* Due date */}
                <span className={`text-sm ${invoice.status === "OVERDUE" ? "text-red-600 font-semibold" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                </span>

                {/* Total */}
                <span className="text-sm text-right font-medium text-zinc-700 dark:text-zinc-300 block">{formatCurrency(invoice.totalAmount)}</span>

                {/* Paid */}
                <span className="text-sm text-right text-emerald-600 dark:text-emerald-400 block">{formatCurrency(invoice.paidAmount)}</span>

                {/* Balance */}
                <span className={`text-sm text-right font-bold block ${invoice.balanceAmount > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-400"}`}>
                  {formatCurrency(invoice.balanceAmount)}
                </span>

                {/* Actions — absolute overlay so they don't shift Balance column */}
                <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 dark:bg-zinc-900/95 rounded-r-2xl pl-6">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </Link>
                  <a
                    href={`/api/invoices/${invoice.id}/download`}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </a>
                  {canPay && (
                    <button
                      onClick={() => handleCheckout(invoice.id)}
                      disabled={loadingInvoiceId === invoice.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors disabled:opacity-40"
                    >
                      {loadingInvoiceId === invoice.id ? "…" : labels.payNow}
                    </button>
                  )}
                  {canDeleteInvoices && (
                    <button
                      onClick={() => { setFeedback(null); setPendingDeleteInvoiceId(invoice.id); }}
                      disabled={!canDelete || isPending}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
        </div>
      </div>

      <TablePagination
        page={safePage}
        pageSize={pageSize}
        totalItems={filteredInvoices.length}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        labels={
          language === "ur"
            ? { showing: "دکھایا جا رہا ہے", of: "میں سے", rowsPerPage: "قطاریں", page: "صفحہ", previous: "پچھلا", next: "اگلا" }
            : { showing: "Showing", of: "of", rowsPerPage: "Rows", page: "Page", previous: "Previous", next: "Next" }
        }
      />

      {/* ── Delete Confirmation ──────────────────────────────────────── */}
      <Dialog open={Boolean(pendingDeleteInvoiceId)} onOpenChange={(open) => !open && setPendingDeleteInvoiceId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{labels.deleteTitle}</DialogTitle>
            <DialogDescription>{labels.deleteDescription}</DialogDescription>
          </DialogHeader>
          {pendingDeleteInvoice && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-sm text-zinc-700 dark:text-zinc-300">
              <p className="font-semibold">{pendingDeleteInvoice.invoiceNumber}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{pendingDeleteInvoice.type} · {pendingDeleteInvoice.status}</p>
            </div>
          )}
          <p className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-300">
            {labels.deleteWarning}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDeleteInvoiceId(null)} disabled={isPending} className="rounded-xl">{labels.cancel}</Button>
            <Button variant="destructive" onClick={handleDeleteInvoice} disabled={isPending} className="rounded-xl">
              {isPending ? "…" : labels.confirmDelete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
