"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GripVertical, Eye, EyeOff } from "lucide-react";

export interface ExportColumnOption {
  key: string;
  label: string;
  defaultVisible: boolean;
}

export interface ExportOptions {
  visibleColumns: string[];
  sortBy: "date" | "voucherNo" | "amount" | "category";
  sortDirection: "asc" | "desc";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  includeHeader: boolean;
  includeFooter: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  visibleColumns: ["date", "voucherNo", "category", "description", "paidTo", "paymentMethod", "project", "amount"],
  sortBy: "date",
  sortDirection: "asc",
  dateFormat: "DD/MM/YYYY",
  includeHeader: true,
  includeFooter: true,
};

const STORAGE_KEY = "lumina-export-options";

export function loadExportOptions(): ExportOptions {
  if (typeof window === "undefined") return DEFAULT_OPTIONS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_OPTIONS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return DEFAULT_OPTIONS;
}

export function saveExportOptions(opts: ExportOptions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
}

export const EXPENSE_COLUMNS: ExportColumnOption[] = [
  { key: "date", label: "Date", defaultVisible: true },
  { key: "voucherNo", label: "Voucher No", defaultVisible: true },
  { key: "category", label: "Category", defaultVisible: true },
  { key: "description", label: "Description", defaultVisible: true },
  { key: "paidTo", label: "Paid To", defaultVisible: true },
  { key: "paymentMethod", label: "Payment Method", defaultVisible: true },
  { key: "project", label: "Project", defaultVisible: true },
  { key: "remarks", label: "Remarks", defaultVisible: false },
  { key: "amount", label: "Amount", defaultVisible: true },
];

export function ExportOptionsDialog({
  open,
  onOpenChange,
  onApply,
  columns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (options: ExportOptions) => void;
  columns: ExportColumnOption[];
}) {
  const [opts, setOpts] = useState<ExportOptions>(DEFAULT_OPTIONS);

  useEffect(() => {
    if (open) {
      setOpts(loadExportOptions());
    }
  }, [open]);

  function toggleColumn(key: string) {
    setOpts((prev) => {
      const visible = prev.visibleColumns.includes(key)
        ? prev.visibleColumns.filter((k) => k !== key)
        : [...prev.visibleColumns, key];
      return { ...prev, visibleColumns: visible };
    });
  }

  function moveColumn(key: string, dir: -1 | 1) {
    setOpts((prev) => {
      const cols = [...prev.visibleColumns];
      const idx = cols.indexOf(key);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= cols.length) return prev;
      [cols[idx], cols[newIdx]] = [cols[newIdx], cols[idx]];
      return { ...prev, visibleColumns: cols };
    });
  }

  function handleApply() {
    saveExportOptions(opts);
    onApply(opts);
    onOpenChange(false);
  }

  function handleReset() {
    setOpts(DEFAULT_OPTIONS);
    saveExportOptions(DEFAULT_OPTIONS);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Options</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Column visibility & order */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Columns (drag to reorder)</Label>
            {columns.map((col) => {
              const isVisible = opts.visibleColumns.includes(col.key);
              const idx = opts.visibleColumns.indexOf(col.key);
              return (
                <div key={col.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${isVisible ? "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900" : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 opacity-50"}`}>
                  <button onClick={() => toggleColumn(col.key)} className="shrink-0">
                    {isVisible ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-zinc-400" />}
                  </button>
                  <span className="flex-1 text-sm">{col.label}</span>
                  {isVisible && (
                    <div className="flex gap-0.5">
                      <button onClick={() => moveColumn(col.key, -1)} disabled={idx === 0} className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                        <GripVertical className="h-3 w-3 -rotate-90" />
                      </button>
                      <button onClick={() => moveColumn(col.key, 1)} disabled={idx === opts.visibleColumns.length - 1} className="p-1 rounded text-zinc-400 hover:text-zinc-700 disabled:opacity-30">
                        <GripVertical className="h-3 w-3 rotate-90" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sort */}
          <div className="space-y-1.5">
            <Label>Sort By</Label>
            <div className="flex gap-2">
              <select value={opts.sortBy} onChange={(e) => setOpts({ ...opts, sortBy: e.target.value as ExportOptions["sortBy"] })} className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="date">Date</option>
                <option value="voucherNo">Voucher No</option>
                <option value="amount">Amount</option>
                <option value="category">Category</option>
              </select>
              <select value={opts.sortDirection} onChange={(e) => setOpts({ ...opts, sortDirection: e.target.value as ExportOptions["sortDirection"] })} className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="asc">Oldest / A-Z First</option>
                <option value="desc">Newest / Z-A First</option>
              </select>
            </div>
          </div>

          {/* Date format */}
          <div className="space-y-1.5">
            <Label>Date Format</Label>
            <select value={opts.dateFormat} onChange={(e) => setOpts({ ...opts, dateFormat: e.target.value as ExportOptions["dateFormat"] })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 29/06/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 06/29/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-06-29)</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>Reset Defaults</Button>
          <Button onClick={handleApply}>Apply & Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
