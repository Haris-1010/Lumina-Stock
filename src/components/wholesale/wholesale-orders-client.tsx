"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Package } from "lucide-react";
import type { WholesaleOrderSummary, WholesaleOrderStatus } from "@/lib/actions/wholesale";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  WholesaleOrderStatus,
  { label: string; className: string }
> = {
  DRAFT:            { label: "Draft",            className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  PENDING_APPROVAL: { label: "Pending Approval", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  APPROVED:         { label: "Approved",         className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  PROCESSING:       { label: "Processing",       className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  SHIPPED:          { label: "Shipped",          className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  DELIVERED:        { label: "Delivered",        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  INVOICED:         { label: "Invoiced",         className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  CANCELLED:        { label: "Cancelled",        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const ALL_STATUSES: WholesaleOrderStatus[] = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "SHIPPED", "DELIVERED", "INVOICED", "CANCELLED",
];

interface Props {
  initialOrders: WholesaleOrderSummary[];
}

export function WholesaleOrdersClient({ initialOrders }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WholesaleOrderStatus | "ALL">("ALL");

  const filtered = initialOrders.filter((o) => {
    const matchesSearch =
      !search ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer.companyName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders or customers…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WholesaleOrderStatus | "ALL")}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="ALL">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        <Link
          href="/wholesale-orders/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Order
        </Link>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
          <Package className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-zinc-500">
            {initialOrders.length === 0 ? "No wholesale orders yet" : "No orders match your filters"}
          </p>
          {initialOrders.length === 0 && (
            <Link
              href="/wholesale-orders/new"
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Create your first order
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-300">Order #</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-300">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-300">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-300">Items</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-300">Total</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-300">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((order) => {
                const cfg = STATUS_CONFIG[order.status];
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/wholesale-orders/${order.id}`}
                        className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{order.customer.name}</p>
                      {order.customer.companyName && (
                        <p className="text-xs text-zinc-400">{order.customer.companyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.className)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-200">
                      {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400 text-xs">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
