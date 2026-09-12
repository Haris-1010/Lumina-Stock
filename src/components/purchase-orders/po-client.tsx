"use client";

import { getCurrentOrganizationBranding } from "@/lib/actions/organization-settings";

import { useCallback, useMemo, useState, useTransition } from "react";
import { FileText, Zap, Download, Search, Plus, Trash2, ChevronDown, ChevronRight, Filter, Truck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/layout/empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { withUrduMeaning } from "@/lib/urdu-glossary";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  autoGeneratePOs,
  generatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrderForCurrentOrganization,
} from "@/lib/actions/purchase-orders";
import {
  queuePendingPO,
  getPendingPOs,
  removePendingPO,
  generatePendingId,
} from "@/lib/offline-storage";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  totalCost: number;
  createdAt: Date;
  supplier: { name: string };
  items: {
    id: string;
    quantity: number;
    cost: number;
    product: { name: string; sku: string };
  }[];
}

interface Supplier {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  costPrice: number;
  currentStock: number;
  supplierId: string | null;
}

interface POLineItem {
  productId: string;
  quantity: number;
  cost: number;
}

const STATUS_FLOW: Record<string, string> = {
  DRAFT: "SENT",
  SENT: "RECEIVED",
};

export function PurchaseOrdersClient({
  purchaseOrders: initialPOs,
  organizationId,
  canManagePurchaseOrders,
  suppliers,
  products,
  initialSupplierFilter = "all",
}: {
  purchaseOrders: PurchaseOrder[];
  organizationId: string;
  canManagePurchaseOrders: boolean;
  suppliers: Supplier[];
  products: ProductOption[];
  initialSupplierFilter?: string;
}) {
  const { t, language } = useI18n();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialPOs);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DRAFT" | "SENT" | "RECEIVED">("ALL");
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierFilter);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Create PO dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [lineItems, setLineItems] = useState<POLineItem[]>([{ productId: "", quantity: 1, cost: 0 }]);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete PO state
  const [deleteConfirmPO, setDeleteConfirmPO] = useState<PurchaseOrder | null>(null);

  // ── Offline: sync queued POs when coming back online ──────────────────────
  const syncPendingPOs = useCallback(() => {
    const pending = getPendingPOs();
    if (pending.length === 0) return;

    startTransition(async () => {
      for (const po of pending) {
        try {
          await generatePurchaseOrder(po.organizationId, po.supplierId, po.lines);
          removePendingPO(po.id);
        } catch {
          // leave for next retry
        }
      }
      // Reload to fetch real PO numbers from server
      window.location.reload();
    });
  }, []);

  const isOnline = useOnlineStatus(syncPendingPOs);

  const handleDeletePO = () => {
    if (!deleteConfirmPO) return;
    startTransition(async () => {
      const result = await deletePurchaseOrderForCurrentOrganization(deleteConfirmPO.id);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        setPurchaseOrders((prev) => prev.filter((p) => p.id !== deleteConfirmPO.id));
        setFeedback({ type: "success", message: `PO ${deleteConfirmPO.poNumber} moved to recycle bin.` });
      }
      setDeleteConfirmPO(null);
    });
  };

  const handleAutoGenerate = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await autoGeneratePOs(organizationId);
        setFeedback({ type: "success", message: "Purchase orders generated for all products at or below reorder point." });
        window.location.reload();
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to auto-generate POs." });
      }
    });
  };

  const handleStatusAdvance = (po: PurchaseOrder) => {
    const nextStatus = STATUS_FLOW[po.status];
    if (!nextStatus) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        await updatePurchaseOrderStatus(po.id, nextStatus as "SENT" | "RECEIVED");
        setPurchaseOrders((prev) =>
          prev.map((p) => (p.id === po.id ? { ...p, status: nextStatus } : p))
        );
        const msg = nextStatus === "RECEIVED"
          ? `PO ${po.poNumber} marked as received. Stock updated.`
          : `PO ${po.poNumber} marked as sent.`;
        setFeedback({ type: "success", message: msg });
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to update status." });
      }
    });
  };

  const handleDownloadPDF = (po: PurchaseOrder) => {
    Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      getCurrentOrganizationBranding(),
    ]).then(([{ jsPDF }, { default: autoTable }, branding]) => {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(branding.name, 14, 10, { maxWidth: 180 });
      doc.setFontSize(8);
      const contact = [branding.address, branding.phone].filter(Boolean).join(" · ");
      const contactWidth = doc.getTextWidth(contact);
      if (contactWidth > 180) doc.setFontSize(8 * 180 / contactWidth);
      doc.text(contact, 14, 16);
      doc.setFontSize(16);
      doc.text(t("purchaseOrders.pdf.title"), 14, 26);
      doc.setFontSize(10);
      doc.text(`${t("purchaseOrders.pdf.poNumber")}: ${po.poNumber}`, 14, 35);
      doc.text(`${t("purchaseOrders.pdf.supplier")}: ${po.supplier.name}`, 14, 42);
      doc.text(`${t("purchaseOrders.pdf.date")}: ${formatDate(po.createdAt)}`, 14, 49);
      doc.text(`${t("purchaseOrders.pdf.status")}: ${po.status}`, 14, 56);
      const tableData = po.items.map((item) => [
        item.product.sku,
        item.product.name,
        item.quantity.toString(),
        formatCurrency(item.cost),
        formatCurrency(item.quantity * item.cost),
      ]);
      autoTable(doc, {
        startY: 65,
        head: [[t("inventory.table.sku"), t("inventory.table.product"), t("purchaseOrders.table.quantity"), t("purchaseOrders.table.unitCost"), t("purchaseOrders.table.total")]],
        body: tableData,
        foot: [["", "", "", t("purchaseOrders.pdf.grandTotal"), formatCurrency(po.totalCost)]],
        theme: "striped",
        headStyles: { fillColor: [124, 58, 237] },
      });
      doc.save(`${po.poNumber}.pdf`);
    }).catch(() => setFeedback({ type: "error", message: "Could not load store branding or generate the PDF. Please try again." }));
  };

  // Create PO helpers
  function openCreate() {
    setSelectedSupplierId(suppliers[0]?.id || "");
    setLineItems([{ productId: "", quantity: 1, cost: 0 }]);
    setCreateError(null);
    setCreateOpen(true);
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { productId: "", quantity: 1, cost: 0 }]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof POLineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "productId" && typeof value === "string") {
          const product = products.find((p) => p.id === value);
          return { ...item, productId: value, cost: product?.costPrice ?? item.cost };
        }
        return { ...item, [field]: value };
      })
    );
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!selectedSupplierId) { setCreateError("Please select a supplier."); return; }
    const validLines = lineItems.filter((l) => l.productId && l.quantity > 0 && l.cost >= 0);
    if (validLines.length === 0) { setCreateError("Add at least one line item with a product and quantity."); return; }

    // ── Offline path ──────────────────────────────────────────────────────
    if (!isOnline) {
      const pendingId = generatePendingId("PEND-PO");
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      const totalCost = validLines.reduce((sum, l) => sum + l.quantity * l.cost, 0);

      queuePendingPO({
        id: pendingId,
        createdAtIso: new Date().toISOString(),
        organizationId,
        supplierId: selectedSupplierId,
        lines: validLines,
      });

      // Optimistic UI: add a draft PO with a pending order number
      const tempPO: PurchaseOrder = {
        id: pendingId,
        poNumber: pendingId,
        status: "DRAFT",
        totalCost,
        createdAt: new Date(),
        supplier: { name: supplier?.name ?? "—" },
        items: validLines.map((l) => {
          const prod = products.find((p) => p.id === l.productId);
          return {
            id: `${pendingId}-${l.productId}`,
            quantity: l.quantity,
            cost: l.cost,
            product: { name: prod?.name ?? "—", sku: prod?.sku ?? "—" },
          };
        }),
      };

      setPurchaseOrders((prev) => [tempPO, ...prev]);
      setCreateOpen(false);
      setLineItems([{ productId: "", quantity: 1, cost: 0 }]);
      setSelectedSupplierId("");
      setFeedback({
        type: "success",
        message: language === "ur"
          ? "PO آف لائن محفوظ ہو گیا۔ آن لائن آنے پر خودکار sync ہو گا۔"
          : "PO saved offline. It will sync automatically when you reconnect.",
      });
      return;
    }

    // ── Online path ───────────────────────────────────────────────────────
    startTransition(async () => {
      try {
        await generatePurchaseOrder(organizationId, selectedSupplierId, validLines);
        setCreateOpen(false);
        setFeedback({ type: "success", message: "Purchase order created." });
        window.location.reload();
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Failed to create purchase order.");
      }
    });
  }

  const createTotal = lineItems.reduce((sum, l) => sum + (l.quantity || 0) * (l.cost || 0), 0);

  const STATUS_PILL: Record<string, string> = {
    DRAFT:    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    SENT:     "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  };

  const filteredPurchaseOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      const searchMatch =
        normalizedSearch.length === 0 ||
        po.poNumber.toLowerCase().includes(normalizedSearch) ||
        po.supplier.name.toLowerCase().includes(normalizedSearch);
      const statusMatch = statusFilter === "ALL" || po.status === statusFilter;
      const supplierMatch = supplierFilter === "all" || suppliers.find((s) => s.id === supplierFilter)?.name === po.supplier.name;
      return searchMatch && statusMatch && supplierMatch;
    });
  }, [purchaseOrders, search, statusFilter, supplierFilter, suppliers]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchaseOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedPurchaseOrders = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredPurchaseOrders.slice(start, start + pageSize);
  }, [filteredPurchaseOrders, safePage, pageSize]);

  return (
    <div className="space-y-5">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={language === "ur" ? "PO نمبر یا سپلائر سے تلاش کریں" : "Search PO or supplier…"}
              className="pl-9 rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
              <SelectTrigger className="h-9 w-[140px] rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 text-sm">
                <SelectValue placeholder={language === "ur" ? "تمام اسٹیٹس" : "All Status"} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL">{language === "ur" ? "تمام اسٹیٹس" : "All Status"}</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
              </SelectContent>
            </Select>
            {suppliers.length > 0 && (
              <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[160px] rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 text-sm">
                  <SelectValue placeholder={language === "ur" ? "تمام سپلائرز" : "All Suppliers"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">{language === "ur" ? "تمام سپلائرز" : "All Suppliers"}</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {canManagePurchaseOrders ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={openCreate}
              disabled={suppliers.length === 0}
              className="rounded-xl h-9 text-sm gap-1.5 border-zinc-200 dark:border-zinc-700"
            >
              <Plus className="h-4 w-4" />
              {language === "ur" ? "نیا PO بنائیں" : "Create PO"}
            </Button>
            <Button
              onClick={handleAutoGenerate}
              disabled={isPending}
              className="rounded-xl h-9 text-sm gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200/50 dark:shadow-none"
            >
              <Zap className="h-4 w-4" />
              {isPending ? t("purchaseOrders.generating") : t("purchaseOrders.autoGenerate")}
            </Button>
          </div>
        ) : (
          <p className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
            {language === "ur" ? "آپ کو پرچیز آرڈر جنریٹ کرنے کی اجازت نہیں ہے۔" : "You do not have permission to manage purchase orders."}
          </p>
        )}
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

      {/* ── PO List ─────────────────────────────────────────────────── */}
      {purchaseOrders.length === 0 ? (
        <EmptyState
          title={t("purchaseOrders.emptyTitle")}
          description={t("purchaseOrders.emptyDescription")}
          action={canManagePurchaseOrders ? { label: t("purchaseOrders.autoGenerate"), onClick: handleAutoGenerate } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {/* Table wrapper */}
          <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-zinc-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {language === "ur" ? "پرچیز آرڈرز" : "Purchase Orders"}
                </span>
              </div>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                {filteredPurchaseOrders.length}{filteredPurchaseOrders.length !== purchaseOrders.length ? ` / ${purchaseOrders.length}` : ""}
              </span>
            </div>

            {paginatedPurchaseOrders.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
                {language === "ur" ? "کوئی پرچیز آرڈر فلٹر کے مطابق نہیں ملا۔" : "No purchase orders match your filters."}
              </div>
            ) : (
              paginatedPurchaseOrders.map((po) => (
                <div key={po.id} className="border-b border-zinc-100/60 dark:border-zinc-800/40 last:border-0">
                  {/* PO Row */}
                  <div
                    className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    onClick={() => setExpandedPO(expandedPO === po.id ? null : po.id)}
                  >
                    {/* Expand toggle */}
                    <div className="shrink-0 text-zinc-400">
                      {expandedPO === po.id
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </div>

                    {/* PO icon */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      <FileText className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                    </div>

                    {/* PO details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{po.poNumber}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_PILL[po.status] || STATUS_PILL.DRAFT}`}>
                          {po.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {withUrduMeaning(po.supplier.name, language)} · {formatDate(po.createdAt)} · {po.items.length} item{po.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>

                    {/* Total */}
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 shrink-0">
                      {formatCurrency(po.totalCost)}
                    </span>

                    {/* Actions — wrap to their own row on mobile */}
                    <div
                      className="flex w-full items-center justify-end gap-1 shrink-0 md:w-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canManagePurchaseOrders && STATUS_FLOW[po.status] && (
                        <button
                          onClick={() => handleStatusAdvance(po)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 transition-colors disabled:opacity-40"
                        >
                          Mark {STATUS_FLOW[po.status]}
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadPDF(po)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </button>
                      {canManagePurchaseOrders && po.status !== "RECEIVED" && (
                        <button
                          onClick={() => setDeleteConfirmPO(po)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded items */}
                  {expandedPO === po.id && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                      <div className="overflow-x-auto">
                      <div className="min-w-[560px]">
                        {/* Items header */}
                        <div className="grid grid-cols-[1fr_3fr_80px_110px_110px] px-4 py-2 bg-zinc-50/80 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800">
                          {["SKU", "Product", "Qty", "Unit Cost", "Total"].map((h, i) => (
                            <span key={i} className={`text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${i >= 2 ? "text-right" : ""}`}>{h}</span>
                          ))}
                        </div>
                        {po.items.map((item) => (
                          <div key={item.id} className="grid grid-cols-[1fr_3fr_80px_110px_110px] items-center px-4 py-2.5 border-b border-zinc-100/60 dark:border-zinc-800/40 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded w-fit">{item.product.sku}</span>
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate pr-2">{withUrduMeaning(item.product.name, language)}</span>
                            <span className="text-sm text-right text-zinc-600 dark:text-zinc-400">{item.quantity}</span>
                            <span className="text-sm text-right text-zinc-600 dark:text-zinc-400">{formatCurrency(item.cost)}</span>
                            <span className="text-sm text-right font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(item.quantity * item.cost)}</span>
                          </div>
                        ))}
                        {/* Grand total */}
                        <div className="grid grid-cols-[1fr_3fr_80px_110px_110px] items-center px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-700">
                          <span />
                          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 col-span-3 text-right pr-0">Total</span>
                          <span className="text-sm font-bold text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(po.totalCost)}</span>
                        </div>
                      </div>
                      </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <TablePagination
            page={safePage}
            pageSize={pageSize}
            totalItems={filteredPurchaseOrders.length}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            labels={
              language === "ur"
                ? { showing: "دکھایا جا رہا ہے", of: "میں سے", rowsPerPage: "قطاریں", page: "صفحہ", previous: "پچھلا", next: "اگلا" }
                : { showing: "Showing", of: "of", rowsPerPage: "Rows", page: "Page", previous: "Previous", next: "Next" }
            }
          />
        </div>
      )}

      {/* ── Create PO Dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Select a supplier and add the products you want to order.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-5 pt-2">
            {createError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {createError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="po-supplier">Supplier *</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger id="po-supplier" className="rounded-xl">
                  <SelectValue placeholder="Choose supplier…" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="rounded-xl text-xs h-7 gap-1">
                  <Plus className="h-3 w-3" />
                  Add Line
                </Button>
              </div>
              {lineItems.map((line, index) => {
                const selectedProduct = products.find((p) => p.id === line.productId);
                return (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 sm:grid-cols-[1fr_80px_90px_32px] sm:items-end sm:gap-2 sm:rounded-none sm:border-0 sm:p-0"
                  >
                    <div className="space-y-1">
                      <span className={cn("text-xs text-zinc-500", index !== 0 && "sm:hidden")}>Product</span>
                      <Select value={line.productId || "__none__"} onValueChange={(v) => updateLineItem(index, "productId", v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-9 rounded-xl">
                          <SelectValue placeholder="Select product…" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="__none__">— Select —</SelectItem>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectedProduct && <p className="text-xs text-zinc-400">Stock: {selectedProduct.currentStock}</p>}
                    </div>
                    <div className="space-y-1">
                      <span className={cn("text-xs text-zinc-500", index !== 0 && "sm:hidden")}>Qty</span>
                      <Input type="number" min="1" step="1" className="h-9 rounded-xl" value={line.quantity} onChange={(e) => updateLineItem(index, "quantity", parseInt(e.target.value, 10) || 1)} />
                    </div>
                    <div className="space-y-1">
                      <span className={cn("text-xs text-zinc-500", index !== 0 && "sm:hidden")}>Unit Cost</span>
                      <Input type="number" min="0" step="0.01" className="h-9 rounded-xl" value={line.cost} onChange={(e) => updateLineItem(index, "cost", parseFloat(e.target.value) || 0)} />
                    </div>
                    <button
                      type="button"
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-30 sm:w-8"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="text-xs font-medium sm:hidden">Remove item</span>
                    </button>
                  </div>
                );
              })}
              <div className="flex justify-end border-t border-zinc-100 dark:border-zinc-800 pt-2">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Total: {formatCurrency(createTotal)}</p>
              </div>
            </div>
            {!isOnline && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                {language === "ur"
                  ? "آف لائن موڈ — PO لوکل محفوظ ہو گا اور آن لائن آنے پر sync ہو گا۔"
                  : "Offline mode — PO will be saved locally and synced when you reconnect."}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isPending} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                {isPending ? "Creating…" : isOnline ? "Create Purchase Order" : "Save Offline"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete PO Confirmation ───────────────────────────────────── */}
      <Dialog open={!!deleteConfirmPO} onOpenChange={(open) => { if (!open) setDeleteConfirmPO(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Purchase Order</DialogTitle>
            <DialogDescription>
              Move <strong>{deleteConfirmPO?.poNumber}</strong> to the recycle bin? You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmPO(null)} disabled={isPending} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePO} disabled={isPending} className="rounded-xl">
              {isPending ? "Moving…" : "Move to Bin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
