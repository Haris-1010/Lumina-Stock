"use client";

import { useMemo, useState, useTransition } from "react";
import { Edit3, Search, Filter, X } from "lucide-react";
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
import { useI18n } from "@/components/providers/i18n-provider";
import { withUrduMeaning } from "@/lib/urdu-glossary";
import { formatNumber } from "@/lib/utils";
import { updateSelectedProductsForCurrentOrganization } from "@/lib/actions/inventory";

interface ForecastRow {
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number | null;
  safetyStock: number;
  suggestedReorderQty: number;
}

type UrgencyFilter = "ALL" | "CRITICAL" | "URGENT" | "WATCH" | "HEALTHY" | "NO_SALES";

function UrgencyPill({ days }: { days: number | null }) {
  if (days === null)
    return <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">No Sales</span>;
  if (days <= 3)
    return <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">Critical</span>;
  if (days <= 7)
    return <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Urgent</span>;
  if (days <= 14)
    return <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Watch</span>;
  return <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Healthy</span>;
}

export function ForecastTableClient({
  rows,
  canUseRecordControls,
}: {
  rows: ForecastRow[];
  canUseRecordControls: boolean;
}) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editRow, setEditRow] = useState<ForecastRow | null>(null);
  const [reorderPointInput, setReorderPointInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [localRows, setLocalRows] = useState<ForecastRow[]>(rows);

  const labels =
    language === "ur"
      ? {
          search: "پروڈکٹ یا SKU سے تلاش کریں",
          allUrgency: "تمام ترجیحات",
          critical: "انتہائی اہم",
          urgent: "فوری",
          watch: "نگرانی",
          healthy: "صحت مند",
          noSales: "کوئی فروخت نہیں",
          noMatches: "کوئی ریکارڈ فلٹر کے مطابق نہیں ملا۔",
          edit: "ترمیم",
          editTitle: "ریکارڈ ترمیم کریں",
          editDescription: "ری آرڈر پوائنٹ اپ ڈیٹ کریں۔",
          reorderPoint: "ری آرڈر پوائنٹ",
          save: "محفوظ کریں",
          cancel: "منسوخ",
          showing: "دکھایا جا رہا ہے",
          of: "میں سے",
          rowsPerPage: "قطاریں",
          page: "صفحہ",
          previous: "پچھلا",
          next: "اگلا",
        }
      : {
          search: "Search by product or SKU",
          allUrgency: "All Urgency",
          critical: "Critical",
          urgent: "Urgent",
          watch: "Watch",
          healthy: "Healthy",
          noSales: "No Sales",
          noMatches: "No records match your filters.",
          edit: "Edit",
          editTitle: "Edit Record",
          editDescription: "Update the reorder point for this product.",
          reorderPoint: "Reorder Point",
          save: "Save",
          cancel: "Cancel",
          showing: "Showing",
          of: "of",
          rowsPerPage: "Rows",
          page: "Page",
          previous: "Previous",
          next: "Next",
        };

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return localRows.filter((item) => {
      const searchMatch =
        normalizedSearch.length === 0 ||
        item.sku.toLowerCase().includes(normalizedSearch) ||
        item.productName.toLowerCase().includes(normalizedSearch);

      const urgencyMatch =
        urgencyFilter === "ALL" ||
        (item.daysUntilStockout === null && urgencyFilter === "NO_SALES") ||
        (item.daysUntilStockout !== null &&
          ((item.daysUntilStockout <= 3 && urgencyFilter === "CRITICAL") ||
            (item.daysUntilStockout > 3 && item.daysUntilStockout <= 7 && urgencyFilter === "URGENT") ||
            (item.daysUntilStockout > 7 && item.daysUntilStockout <= 14 && urgencyFilter === "WATCH") ||
            (item.daysUntilStockout > 14 && urgencyFilter === "HEALTHY")));

      return searchMatch && urgencyMatch;
    });
  }, [localRows, search, urgencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  function openEdit(row: ForecastRow) {
    setEditRow(row);
    setReorderPointInput(String(row.safetyStock));
    setFeedback(null);
  }

  function handleSave() {
    if (!editRow) return;
    const reorderPoint = parseInt(reorderPointInput, 10);
    if (!Number.isFinite(reorderPoint) || reorderPoint < 0) {
      setFeedback({ type: "error", message: "Reorder point must be a non-negative number." });
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateSelectedProductsForCurrentOrganization({ productIds: [editRow.productId], updates: { reorderPoint } });
        if (result && "error" in result && result.error) {
          setFeedback({ type: "error", message: result.error as string });
          return;
        }
        setLocalRows((prev) =>
          prev.map((r) =>
            r.productId === editRow.productId ? { ...r, safetyStock: reorderPoint } : r
          )
        );
        setEditRow(null);
        setFeedback({ type: "success", message: `Reorder point updated for ${editRow.productName}.` });
      } catch (err) {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to save." });
      }
    });
  }

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">{t("forecasts.noProducts")}</p>;
  }

  const cols = "grid-cols-[56px_1fr_80px_90px_100px_80px_90px_110px_44px]";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={labels.search}
            className="pl-9 rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
          <Select value={urgencyFilter} onValueChange={(v) => { setUrgencyFilter(v as UrgencyFilter); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-9 rounded-xl border-zinc-200 dark:border-zinc-700 text-sm">
              <SelectValue placeholder={labels.allUrgency} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{labels.allUrgency}</SelectItem>
              <SelectItem value="CRITICAL">{labels.critical}</SelectItem>
              <SelectItem value="URGENT">{labels.urgent}</SelectItem>
              <SelectItem value="WATCH">{labels.watch}</SelectItem>
              <SelectItem value="HEALTHY">{labels.healthy}</SelectItem>
              <SelectItem value="NO_SALES">{labels.noSales}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
          feedback.type === "error"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm">
        {/* Column headers */}
        <div className={`grid ${cols} min-w-[700px] items-center px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40`}>
          {[
            t("inventory.table.sku"),
            t("inventory.table.product"),
            t("forecasts.table.currentStock"),
            t("forecasts.table.avgDailySales"),
            t("forecasts.table.daysUntilStockout"),
            t("forecasts.table.safetyStock"),
            t("forecasts.table.suggestedReorder"),
            t("forecasts.table.urgency"),
            "",
          ].map((h, i) => (
            <span key={i} className={`text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${i >= 2 && i <= 6 ? "text-right" : ""}`}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {filteredRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">{labels.noMatches}</div>
        ) : (
          visibleRows.map((item) => (
            <div
              key={item.productId}
              className={`group grid ${cols} min-w-[700px] items-center px-4 py-3 border-b border-zinc-100/60 dark:border-zinc-800/40 last:border-0 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40`}
            >
              <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded w-fit">
                {item.sku}
              </span>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate pr-4">
                {withUrduMeaning(item.productName, language)}
              </span>
              <span className="text-sm text-right text-zinc-700 dark:text-zinc-300 tabular-nums">{formatNumber(item.currentStock)}</span>
              <span className="text-sm text-right text-zinc-600 dark:text-zinc-400 tabular-nums">{item.avgDailySales}</span>
              <span className={`text-sm text-right font-semibold tabular-nums ${
                item.daysUntilStockout === null ? "text-zinc-400" :
                item.daysUntilStockout <= 3 ? "text-red-600 dark:text-red-400" :
                item.daysUntilStockout <= 7 ? "text-amber-600 dark:text-amber-400" :
                "text-zinc-700 dark:text-zinc-300"
              }`}>
                {item.daysUntilStockout === null ? "∞" : item.daysUntilStockout}
              </span>
              <span className="text-sm text-right text-zinc-600 dark:text-zinc-400 tabular-nums">{formatNumber(item.safetyStock)}</span>
              <span className="text-sm text-right font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatNumber(item.suggestedReorderQty)}</span>
              <div className="flex justify-end">
                <UrgencyPill days={item.daysUntilStockout} />
              </div>
              <div className="flex justify-end">
                {canUseRecordControls && (
                  <button
                    onClick={() => openEdit(item)}
                    className="flex items-center justify-center h-7 w-7 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
                    title={labels.edit}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <TablePagination
        page={safePage}
        pageSize={pageSize}
        totalItems={filteredRows.length}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        labels={{
          showing: labels.showing,
          of: labels.of,
          rowsPerPage: labels.rowsPerPage,
          page: labels.page,
          previous: labels.previous,
          next: labels.next,
        }}
      />

      {/* Inline Edit Dialog */}
      <Dialog open={Boolean(editRow)} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.editTitle}</DialogTitle>
            <DialogDescription>
              {editRow?.productName} ({editRow?.sku})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-sm space-y-1.5">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Current stock</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatNumber(editRow?.currentStock ?? 0)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Avg. daily sales</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{editRow?.avgDailySales ?? 0}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Days until stockout</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{editRow?.daysUntilStockout ?? "∞"}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reorder-point">{labels.reorderPoint}</Label>
              <Input
                id="reorder-point"
                type="number"
                min={0}
                value={reorderPointInput}
                onChange={(e) => setReorderPointInput(e.target.value)}
                className="rounded-xl"
                placeholder="e.g. 20"
              />
              <p className="text-xs text-zinc-400">Sets the minimum stock level that triggers a low-stock alert and restocking suggestion.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={isPending} className="rounded-xl">{labels.cancel}</Button>
            <Button onClick={handleSave} disabled={isPending} className="rounded-xl">
              {isPending ? "Saving…" : labels.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
