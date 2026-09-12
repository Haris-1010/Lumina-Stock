"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  recordReturnForCurrentOrganization,
  getReturnableSalesForProduct,
  type ReturnRow,
} from "@/lib/actions/returns";
import {
  RETURN_CONDITION_LABELS,
  type ReturnKind,
  type ReturnCondition,
} from "@/lib/actions/return-types";

interface ProductOption {
  id: string;
  sku: string;
  name: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const RETURN_TYPE_LABELS: Record<ReturnKind, string> = {
  CUSTOMER_RETURN: "Customer Return",
  SUPPLIER_RETURN: "Supplier Return",
};

const TYPE_COLORS: Record<ReturnKind, string> = {
  CUSTOMER_RETURN: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  SUPPLIER_RETURN: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
};

const CONDITION_COLORS: Record<ReturnCondition, string> = {
  RESALEABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  DAMAGED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  EXPIRED: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
};

export function ReturnsClient({
  initialReturns,
  products,
  canEdit,
  currencyCode,
}: {
  initialReturns: ReturnRow[];
  products: ProductOption[];
  canEdit: boolean;
  currencyCode: string;
}) {
  const returns = initialReturns;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ReturnKind | "ALL">("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    salesOrderId: "",
    requestId: "",
    existingReturnId: "",
    productId: "",
    quantity: 1,
    returnType: "CUSTOMER_RETURN" as ReturnKind,
    condition: "RESALEABLE" as ReturnCondition,
    referenceNumber: "",
    note: "",
  });

  const [saleOptions, setSaleOptions] = useState<Awaited<ReturnType<typeof getReturnableSalesForProduct>>>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  useEffect(() => {
    if (!formOpen || !form.productId || form.returnType !== "CUSTOMER_RETURN") return;
    let active = true;
    getReturnableSalesForProduct(form.productId).then(options => {
      if (active) { setSaleOptions(options); setLoadingSales(false); }
    }).catch(() => {
      if (active) { setFormError("Could not load original receipts. Please reopen the return form."); setLoadingSales(false); }
    });
    return () => { active = false; };
  }, [formOpen, form.productId, form.returnType]);

  function openReturn(previous?: ReturnRow) {
    setFormError(null);
    setSaleOptions([]);
    setLoadingSales(Boolean(previous));
    setForm({ productId: previous?.productId ?? "", quantity: previous?.quantity ?? 1,
      returnType: previous?.returnType ?? "CUSTOMER_RETURN", condition: previous?.condition ?? "RESALEABLE",
      referenceNumber: previous?.referenceNumber ?? "", note: previous?.note ?? "", salesOrderId: "",
      existingReturnId: previous?.id ?? "", requestId: crypto.randomUUID() });
    setFormOpen(true);
  }

  const filtered = returns.filter((r) => {
    const matchSearch =
      !search.trim() ||
      r.productName.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase()) ||
      (r.referenceNumber ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || r.returnType === typeFilter;
    return matchSearch && matchType;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await recordReturnForCurrentOrganization(form);
      if (result.error) { setFormError(result.error); return; }
      setFormOpen(false);
      setFeedback({ type: "success", message: "Return recorded successfully." });
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search product, SKU, reference #..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["ALL", "CUSTOMER_RETURN", "SUPPLIER_RETURN"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {t === "ALL" ? "All" : RETURN_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {canEdit && (
          <Button onClick={() => openReturn()} className="gap-2">
            <Plus className="h-4 w-4" /> Record Return
          </Button>
        )}
      </div>

      <div className="text-sm text-zinc-500">{filtered.length} return{filtered.length !== 1 ? "s" : ""}</div>

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <RotateCcw className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">No returns recorded yet.</p>
          </div>
        ) : (
          <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((r) => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{r.productName}</p>
                    <p className="font-mono text-xs text-zinc-400">{r.sku}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500 whitespace-nowrap">{formatDate(r.createdAt)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[r.returnType]}`}>
                    {RETURN_TYPE_LABELS[r.returnType]}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[r.condition]}`}>
                    {r.condition}
                  </span>
                  {r.stockRestored ? (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Restocked</span>
                  ) : (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">{r.returnType === "SUPPLIER_RETURN" ? "Sent to supplier" : "Not restocked"}</span>
                  )}
                </div>
                {r.returnType === "CUSTOMER_RETURN" && <p className="text-xs">Return value: {r.refundAmount === null ? "Needs receipt link" : formatCurrency(r.refundAmount, currencyCode)}</p>}
                {r.needsSaleLink && canEdit && <Button size="sm" variant="outline" onClick={() => openReturn(r)}>Link sale</Button>}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-2 text-xs">
                  <span className="text-zinc-400">Ref: <span className="font-mono text-zinc-600 dark:text-zinc-300">{r.referenceNumber ?? "—"}</span></span>
                  <span className="text-zinc-400">Qty: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{r.quantity}</span></span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Product</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Condition</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-500 uppercase text-xs tracking-wide">Qty</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Ref #</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Stock</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500">Return Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{r.productName}</p>
                    <p className="text-xs text-zinc-400 font-mono">{r.sku}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[r.returnType]}`}>
                      {RETURN_TYPE_LABELS[r.returnType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[r.condition]}`}>
                      {r.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">{r.quantity}</td>
                  <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{r.referenceNumber ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.stockRestored ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Restocked</span>
                    ) : (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">{r.returnType === "SUPPLIER_RETURN" ? "Sent to supplier" : "Not restocked"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.returnType === "CUSTOMER_RETURN" ? (r.refundAmount === null ? "Needs receipt link" : formatCurrency(r.refundAmount, currencyCode)) : "—"}
                    {r.needsSaleLink && canEdit && <Button className="ml-2" size="sm" variant="outline" onClick={() => openReturn(r)}>Link sale</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.existingReturnId ? "Link historical return to sale" : "Record Return"}</DialogTitle>
            <DialogDescription>Customer returns reduce net sales using the original receipt price. Only resaleable customer returns add stock; supplier returns remove stock. Linking an old return does not move stock again.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {formError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">{formError}</p>}
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <select
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                value={form.productId}
                disabled={Boolean(form.existingReturnId)}
                onChange={(e) => { setSaleOptions([]); setLoadingSales(Boolean(e.target.value)); setForm({ ...form, productId: e.target.value, salesOrderId: "" }); }}
                required
              >
                <option value="">Select a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Return Type</Label>
                <select
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  value={form.returnType}
                  disabled={Boolean(form.existingReturnId)}
                  onChange={(e) => { setSaleOptions([]); setLoadingSales(Boolean(form.productId)); setForm({ ...form, returnType: e.target.value as ReturnKind, salesOrderId: "" }); }}
                >
                  {Object.entries(RETURN_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity *</Label>
                <Input disabled={Boolean(form.existingReturnId)} type="number" min={1} step={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <select
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                value={form.condition}
                disabled={Boolean(form.existingReturnId)}
                onChange={(e) => setForm({ ...form, condition: e.target.value as ReturnCondition })}
              >
                {Object.entries(RETURN_CONDITION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-zinc-400">Quantities are stock units (one dozen = 12 units). Supplier returns always remove stock.</p>
            </div>
            {form.returnType === "CUSTOMER_RETURN" && (
              <div className="space-y-1.5">
                <Label htmlFor="return-sale">Original sale receipt *</Label>
                <select id="return-sale" required value={form.salesOrderId} disabled={loadingSales || !form.productId}
                  onChange={e => setForm({ ...form, salesOrderId: e.target.value })}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">{loadingSales ? "Loading receipts..." : "Select original receipt..."}</option>
                  {saleOptions.map(sale => <option key={sale.id} value={sale.id}>{sale.orderNumber} — {sale.customerName ?? "Walk-in customer"} ({new Date(sale.date).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}) — {sale.remaining} units available — {formatCurrency(sale.remainingAmount, currencyCode)}</option>)}
                </select>
                {!loadingSales && form.productId && saleOptions.length === 0 && <p className="text-xs text-amber-600">No unreturned sales found for this product.</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {form.returnType === "SUPPLIER_RETURN" && <div className="space-y-1.5">
                <Label>Supplier reference / RMA (optional)</Label>
                <Input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="PO #, RMA #..." />
              </div>}
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Reason..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending || (form.returnType === "CUSTOMER_RETURN" && (!form.salesOrderId || loadingSales))}>{isPending ? "Saving..." : (form.existingReturnId ? "Link Return" : "Record Return")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
