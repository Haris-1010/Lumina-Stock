"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Truck, PackageCheck, FileText } from "lucide-react";
import type { WholesaleOrderDetail, WholesaleOrderStatus } from "@/lib/actions/wholesale";
import {
  updateWholesaleOrderStatusForCurrentOrganization,
  deleteWholesaleOrderForCurrentOrganization,
} from "@/lib/actions/wholesale";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<WholesaleOrderStatus, { label: string; className: string }> = {
  DRAFT:            { label: "Draft",            className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  PENDING_APPROVAL: { label: "Pending Approval", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  APPROVED:         { label: "Approved",         className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  PROCESSING:       { label: "Processing",       className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" },
  SHIPPED:          { label: "Shipped",          className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  DELIVERED:        { label: "Delivered",        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  INVOICED:         { label: "Invoiced",         className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  CANCELLED:        { label: "Cancelled",        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

interface Props {
  order: WholesaleOrderDetail;
}

export function WholesaleOrderDetailClient({ order: initialOrder }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState("");

  function transition(status: WholesaleOrderStatus) {
    setError("");
    startTransition(async () => {
      const result = await updateWholesaleOrderStatusForCurrentOrganization(order.id, status);
      if (result.error) { setError(result.error); return; }
      setOrder((prev) => ({ ...prev, status }));
    });
  }

  function handleDelete() {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteWholesaleOrderForCurrentOrganization(order.id);
      if (result.error) { setError(result.error); return; }
      router.push("/wholesale-orders");
    });
  }

  const cfg = STATUS_CONFIG[order.status];
  const grossTotal = order.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountTotal = order.items.reduce(
    (s, i) => s + i.quantity * i.unitPrice * (i.discountPct / 100),
    0
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", cfg.className)}>
                {cfg.label}
              </span>
              <span className="text-xs text-zinc-400">
                Created {new Date(order.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div>
                <span className="text-zinc-500">Customer:</span>{" "}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{order.customer.name}</span>
              </div>
              {order.customer.companyName && (
                <div>
                  <span className="text-zinc-500">Company:</span>{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{order.customer.companyName}</span>
                </div>
              )}
              {order.customer.email && (
                <div>
                  <span className="text-zinc-500">Email:</span>{" "}
                  <span className="text-zinc-700 dark:text-zinc-300">{order.customer.email}</span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">Credit limit:</span>{" "}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {order.customer.creditUsed.toFixed(2)} / {order.customer.creditLimit.toFixed(2)}
                </span>
              </div>
            </div>
            {order.notes && (
              <p className="mt-2 text-sm text-zinc-500 italic">{order.notes}</p>
            )}
          </div>

          {/* Action buttons per status */}
          <div className="flex flex-wrap gap-2">
            {order.status === "DRAFT" && (
              <>
                <button
                  onClick={() => transition("PENDING_APPROVAL")}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  Submit for Approval
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors dark:border-red-700 dark:hover:bg-red-950/20"
                >
                  <XCircle className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
            {order.status === "PENDING_APPROVAL" && (
              <>
                <button
                  onClick={() => transition("APPROVED")}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => transition("CANCELLED")}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors dark:border-red-700 dark:hover:bg-red-950/20"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}
            {order.status === "APPROVED" && (
              <button
                onClick={() => transition("PROCESSING")}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Mark Processing
              </button>
            )}
            {order.status === "PROCESSING" && (
              <button
                onClick={() => transition("SHIPPED")}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Truck className="h-4 w-4" />
                Mark Shipped
              </button>
            )}
            {order.status === "SHIPPED" && (
              <button
                onClick={() => transition("DELIVERED")}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <PackageCheck className="h-4 w-4" />
                Mark Delivered
              </button>
            )}
            {order.status === "DELIVERED" && (
              <button
                onClick={() => transition("INVOICED")}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Mark Invoiced
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-300">Product</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-300">Qty</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-300">Unit Price</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-300">Disc %</th>
              <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-300">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {order.items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">{item.product.name}</p>
                  <p className="text-xs text-zinc-400">{item.product.sku}</p>
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                  {item.unitPrice.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                  {item.discountPct > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">{item.discountPct}%</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-200">
                  {item.lineTotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            {discountTotal > 0 && (
              <>
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right text-sm text-zinc-500">Gross</td>
                  <td className="px-4 py-2 text-right text-sm text-zinc-600 dark:text-zinc-400">{grossTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right text-sm text-emerald-600">Discount</td>
                  <td className="px-4 py-2 text-right text-sm text-emerald-600">−{discountTotal.toFixed(2)}</td>
                </tr>
              </>
            )}
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                Order Total
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {order.totalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </button>
    </div>
  );
}
