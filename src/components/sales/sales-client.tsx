"use client";

import { useState, useTransition } from "react";
import { Search, Trash2, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import {
  deleteSalesOrderForCurrentOrganization,
  type SalesOrderRow,
} from "@/lib/actions/sales";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SalesClient({
  initialOrders,
  currencyCode,
  canDelete,
}: {
  initialOrders: SalesOrderRow[];
  currencyCode: string;
  canDelete: boolean;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search.trim() ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.customerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      o.items.some(
        (item) =>
          item.productName.toLowerCase().includes(search.toLowerCase()) ||
          item.sku.toLowerCase().includes(search.toLowerCase())
      );

    const date = new Date(o.date);
    const matchFrom = !from || date >= new Date(from);
    const matchTo = !to || date <= new Date(to + "T23:59:59.999Z");

    return matchSearch && matchFrom && matchTo;
  });

  const totalRevenue = filtered.reduce((sum, o) => sum + o.netAmount, 0);

  function handleDelete(id: string) {
    if (!confirm("Delete this order and restore stock? This cannot be undone.")) return;
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteSalesOrderForCurrentOrganization(id);
      setDeletingId(null);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        setOrders((prev) => prev.filter((o) => o.id !== id));
        setFeedback({ type: "success", message: "Order deleted and stock restored." });
      }
    });
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {feedback.message}
          <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search by order #, customer, product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        {(search || from || to) && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{filtered.length} order{filtered.length !== 1 ? "s" : ""}</span>
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          Net sales: {formatCurrency(totalRevenue, currencyCode)}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Receipt className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">No sales orders found.</p>
          </div>
        ) : (
          <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((order) => (
              <div key={order.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono font-medium text-zinc-900 dark:text-zinc-100">{order.orderNumber}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {formatDate(order.date)} · {order.customerName ?? "Walk-in"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      aria-label="View items"
                      className="p-2 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {expandedId === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(order.id)}
                        disabled={isPending && deletingId === order.id}
                        aria-label="Delete order"
                        className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{order.itemCount} item{order.itemCount !== 1 ? "s" : ""}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(order.netAmount, currencyCode)}{order.returnedAmount > 0 && <span className="block text-xs text-amber-600">Returned: {formatCurrency(order.returnedAmount, currencyCode)}</span>}</span>
                </div>
                {expandedId === order.id && (
                  <div className="space-y-1 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 p-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                          {item.productName} <span className="text-zinc-400">×{item.quantity}{item.returnedQuantity > 0 ? ` (${item.returnedQuantity} returned)` : ""}</span>
                        </span>
                        <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">
                          {formatCurrency(item.netLineTotal, currencyCode)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Order #</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-500 uppercase text-xs tracking-wide">Customer</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-500 uppercase text-xs tracking-wide">Items</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-500 uppercase text-xs tracking-wide">Net Total</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-500 uppercase text-xs tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((order) => (
                <>
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{formatDate(order.date)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {order.customerName ?? <span className="text-zinc-400 italic">Walk-in</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">{order.itemCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(order.netAmount, currencyCode)}{order.returnedAmount > 0 && <span className="block text-xs text-amber-600">Returned: {formatCurrency(order.returnedAmount, currencyCode)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          title="View items"
                        >
                          {expandedId === order.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(order.id)}
                            disabled={isPending && deletingId === order.id}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
                            title="Delete order"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === order.id && (
                    <tr key={`${order.id}-expand`} className="bg-zinc-50/60 dark:bg-zinc-800/30">
                      <td colSpan={6} className="px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-zinc-400 uppercase tracking-wide">
                              <th className="pb-1 text-left">SKU</th>
                              <th className="pb-1 text-left">Product</th>
                              <th className="pb-1 text-right">Qty</th>
                              <th className="pb-1 text-right">Price</th>
                              <th className="pb-1 text-right">Net Line Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                            {order.items.map((item, i) => (
                              <tr key={i}>
                                <td className="py-1 font-mono text-zinc-500">{item.sku}</td>
                                <td className="py-1 text-zinc-700 dark:text-zinc-300">{item.productName}</td>
                                <td className="py-1 text-right text-zinc-500">{item.quantity} {item.returnedQuantity > 0 && <span className="text-amber-600">({item.returnedQuantity} returned)</span>}</td>
                                <td className="py-1 text-right text-zinc-500">{formatCurrency(item.price, currencyCode)}</td>
                                <td className="py-1 text-right font-medium text-zinc-700 dark:text-zinc-300">
                                  {formatCurrency(item.netLineTotal, currencyCode)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
