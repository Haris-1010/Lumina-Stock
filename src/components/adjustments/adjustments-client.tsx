"use client";

import { useState, useTransition } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createStockAdjustmentForCurrentOrganization,
  type AdjustmentRow,
} from "@/lib/actions/adjustments";
import {
  ADJUSTMENT_REASON_LABELS,
  type AdjustmentReason,
} from "@/lib/actions/adjustment-types";

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function reasonBadgeColor(reason: string) {
  if (reason === "DAMAGED" || reason === "THEFT") return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  if (reason === "EXPIRED") return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300";
  if (reason === "FOUND") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

export function AdjustmentsClient({
  initialAdjustments,
  products,
  canEdit,
}: {
  initialAdjustments: AdjustmentRow[];
  products: ProductOption[];
  canEdit: boolean;
}) {
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    productId: "",
    quantity: 1,
    direction: "REMOVE" as "ADD" | "REMOVE",
    reason: "MISCOUNTING" as AdjustmentReason,
    note: "",
  });

  const filtered = adjustments.filter(
    (a) =>
      !search.trim() ||
      a.productName.toLowerCase().includes(search.toLowerCase()) ||
      a.sku.toLowerCase().includes(search.toLowerCase()) ||
      (a.note ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await createStockAdjustmentForCurrentOrganization(form);
      if (result.error) { setFormError(result.error); return; }
      setFormOpen(false);
      setFeedback({ type: "success", message: "Stock adjustment recorded." });
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"}`}>
          {feedback.message}
          <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search by product, SKU, or note..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <Button onClick={() => { setFormError(null); setForm({ productId: "", quantity: 1, direction: "REMOVE", reason: "MISCOUNTING", note: "" }); setFormOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Adjustment
          </Button>
        )}
      </div>

      <div className="text-sm text-zinc-500">{filtered.length} adjustment{filtered.length !== 1 ? "s" : ""}</div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <SlidersHorizontal className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">No stock adjustments recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Product</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Reason</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-500 uppercase text-xs tracking-wide">Qty Change</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((adj) => (
                <tr key={adj.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(adj.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{adj.productName}</p>
                    <p className="text-xs text-zinc-400 font-mono">{adj.sku}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${reasonBadgeColor(adj.reason)}`}>
                      {ADJUSTMENT_REASON_LABELS[adj.reason as AdjustmentReason] ?? adj.reason}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${adj.quantity >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {adj.quantity >= 0 ? "+" : ""}{adj.quantity}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{adj.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Stock Adjustment</DialogTitle>
            <DialogDescription>Manually correct stock levels with a reason for audit trail.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {formError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">{formError}</p>}
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <select
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
                required
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.currentStock} in stock</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <select
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as "ADD" | "REMOVE" })}
                >
                  <option value="REMOVE">Remove (decrease)</option>
                  <option value="ADD">Add (increase)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input type="number" min={1} step={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <select
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value as AdjustmentReason })}
              >
                {Object.entries(ADJUSTMENT_REASON_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Additional Note</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional details..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Record Adjustment"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
