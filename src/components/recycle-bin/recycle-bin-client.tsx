"use client";

import { useState, useTransition } from "react";
import { Trash2, RotateCcw, AlertTriangle, Package, Truck, FileText, ReceiptText, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  restoreRecycleBinItemForCurrentOrganization,
  permanentlyDeleteRecycleBinItemForCurrentOrganization,
  emptyRecycleBinForCurrentOrganization,
  type RecycleBinItem,
} from "@/lib/actions/recycle-bin";

const TYPE_ICONS: Record<RecycleBinItem["type"], React.ElementType> = {
  product: Package,
  supplier: Truck,
  purchaseOrder: FileText,
  invoice: ReceiptText,
  salesOrder: ShoppingCart,
};

function getTypeLabels(language: string): Record<RecycleBinItem["type"], string> {
  return language === "ur"
    ? { product: "پروڈکٹ", supplier: "سپلائر", purchaseOrder: "خریداری آرڈر", invoice: "انوائس", salesOrder: "فروخت رسید" }
    : { product: "Product", supplier: "Supplier", purchaseOrder: "Purchase Order", invoice: "Invoice", salesOrder: "Sales Receipt" };
}

const TYPE_COLORS: Record<RecycleBinItem["type"], string> = {
  product: "bg-blue-50 text-blue-700 border-blue-200",
  supplier: "bg-amber-50 text-amber-700 border-amber-200",
  purchaseOrder: "bg-purple-50 text-purple-700 border-purple-200",
  invoice: "bg-emerald-50 text-emerald-700 border-emerald-200",
  salesOrder: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

function formatDeletedDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  initialItems: RecycleBinItem[];
}

export function RecycleBinClient({ initialItems }: Props) {
  const { language } = useI18n();
  const [items, setItems] = useState<RecycleBinItem[]>(initialItems);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [filterType, setFilterType] = useState<RecycleBinItem["type"] | "all">("all");

  const TYPE_LABELS = getTypeLabels(language);
  const isUr = language === "ur";
  const lbl = {
    bannerTitle: isUr ? "ری سائیکل بن کے بارے میں" : "About the Recycle Bin",
    bannerDesc: isUr
      ? "حذف شدہ ریکارڈز یہاں محفوظ ہیں۔ بحال کریں یا مستقل حذف کریں۔ 30 دن بعد خودبخود صاف ہو سکتے ہیں۔"
      : "Deleted records are kept here so you can restore them if needed. Permanently delete to free up space. Items older than 30 days may be auto-purged.",
    all: isUr ? "سب" : "All",
    emptyBin: isUr ? "بن خالی کریں" : "Empty Bin",
    emptyConfirmText: isUr ? "سب خالی کریں؟ واپس نہیں ہو سکتا۔" : "Empty all? This cannot be undone.",
    yesEmpty: isUr ? "جی، خالی کریں" : "Yes, Empty",
    cancel: isUr ? "منسوخ" : "Cancel",
    emptyStateTitle: isUr ? "ری سائیکل بن خالی ہے" : "Recycle bin is empty",
    emptyStateDesc: isUr ? "حذف شدہ آئٹمز یہاں ظاہر ہوں گے" : "Deleted items will appear here",
    deleted: isUr ? "حذف" : "Deleted",
    restore: isUr ? "بحال کریں" : "Restore",
    delete: isUr ? "حذف کریں" : "Delete",
    restoredMsg: (label: string) => isUr ? `${label} بحال ہو گیا۔` : `${label} restored successfully.`,
    deletedMsg: (label: string) => isUr ? `${label} مستقل حذف ہو گیا۔` : `${label} permanently deleted.`,
    restoreErr: isUr ? "بحال نہیں ہو سکا۔" : "Failed to restore item.",
    deleteErr: isUr ? "حذف نہیں ہو سکا۔" : "Failed to delete item.",
    emptyDoneMsg: isUr ? "ری سائیکل بن خالی ہو گیا۔" : "Recycle bin emptied.",
    emptyErrMsg: isUr ? "بن خالی نہیں ہو سکا۔" : "Failed to empty recycle bin.",
    confirmDeleteMsg: (label: string) => isUr ? `"${label}" مستقل حذف کریں؟ واپس نہیں ہو سکتا۔` : `Permanently delete "${label}"? This cannot be undone.`,
  };

  const filtered = filterType === "all" ? items : items.filter((i) => i.type === filterType);

  function showFeedback(type: "success" | "error", message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  }

  function handleRestore(item: RecycleBinItem) {
    startTransition(async () => {
      const result = await restoreRecycleBinItemForCurrentOrganization(item.id, item.type);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        showFeedback("success", lbl.restoredMsg(item.label));
      } else {
        showFeedback("error", lbl.restoreErr);
      }
    });
  }

  function handlePermanentDelete(item: RecycleBinItem) {
    if (!confirm(lbl.confirmDeleteMsg(item.label))) return;
    startTransition(async () => {
      const result = await permanentlyDeleteRecycleBinItemForCurrentOrganization(item.id, item.type);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        showFeedback("success", lbl.deletedMsg(item.label));
      } else {
        showFeedback("error", lbl.deleteErr);
      }
    });
  }

  function handleEmptyBin() {
    startTransition(async () => {
      const result = await emptyRecycleBinForCurrentOrganization();
      if (result.success) {
        setItems([]);
        setEmptyConfirm(false);
        showFeedback("success", lbl.emptyDoneMsg);
      } else {
        showFeedback("error", lbl.emptyErrMsg);
      }
    });
  }

  const typeGroups: RecycleBinItem["type"][] = ["product", "supplier", "purchaseOrder", "invoice", "salesOrder"];

  return (
    <div className="space-y-5">
      {feedback && (
        <p className={`rounded-md border px-3 py-2 text-sm ${
          feedback.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {feedback.message}
        </p>
      )}

      {/* Purpose banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-amber-800 text-sm">{lbl.bannerTitle}</p>
          <p className="text-amber-700 text-xs mt-0.5">{lbl.bannerDesc}</p>
        </div>
      </div>

      {/* Filters + Empty button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              filterType === "all"
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {lbl.all} ({items.length})
          </button>
          {typeGroups.map((t) => {
            const count = items.filter((i) => i.type === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  filterType === t
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {TYPE_LABELS[t]} ({count})
              </button>
            );
          })}
        </div>

        {items.length > 0 && (
          emptyConfirm ? (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-red-600">{lbl.emptyConfirmText}</span>
              <Button size="sm" variant="destructive" onClick={handleEmptyBin} disabled={isPending}>
                {lbl.yesEmpty}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEmptyConfirm(false)}>
                {lbl.cancel}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setEmptyConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {lbl.emptyBin}
            </Button>
          )
        )}
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <Trash2 className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{lbl.emptyStateTitle}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{lbl.emptyStateDesc}</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${TYPE_COLORS[item.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.sublabel && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.sublabel}</span>
                    )}
                    <Badge variant="outline" className="text-xs py-0 h-4">
                      {TYPE_LABELS[item.type]}
                    </Badge>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 shrink-0 hidden sm:block">
                  {lbl.deleted} {formatDeletedDate(item.deletedAt)}
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-7 px-2 text-xs"
                    onClick={() => handleRestore(item)}
                    disabled={isPending}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {lbl.restore}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                    onClick={() => handlePermanentDelete(item)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {lbl.delete}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
