"use client";

import Link from "next/link";
import { Package, Clock, TrendingUp, AlertCircle, ChevronRight } from "lucide-react";
import type { WholesaleDashboardData, WholesaleOrderStatus } from "@/lib/actions/wholesale";
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
  data: WholesaleDashboardData;
}

export function WholesaleDashboardClient({ data }: Props) {
  const stats = [
    {
      label: "Total Orders",
      value: data.totalOrders,
      icon: Package,
      iconColor: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Pending Approval",
      value: data.pendingApproval,
      icon: Clock,
      iconColor: data.pendingApproval > 0 ? "text-amber-500" : "text-zinc-400",
      bg: data.pendingApproval > 0
        ? "bg-amber-50 dark:bg-amber-950/30"
        : "bg-zinc-50 dark:bg-zinc-800/50",
      alert: data.pendingApproval > 0,
    },
    {
      label: "Total Revenue",
      value: data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: TrendingUp,
      iconColor: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      isCurrency: true,
    },
    {
      label: "Outstanding Balance",
      value: data.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: AlertCircle,
      iconColor: data.outstandingBalance > 0 ? "text-orange-500" : "text-zinc-400",
      bg: data.outstandingBalance > 0
        ? "bg-orange-50 dark:bg-orange-950/30"
        : "bg-zinc-50 dark:bg-zinc-800/50",
      isCurrency: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", stat.bg)}>
                <Icon className={cn("h-6 w-6", stat.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-500">{stat.label}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">Recent Orders</h2>
            <Link
              href="/wholesale-orders"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-400">No orders yet.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.recentOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status];
                return (
                  <Link
                    key={order.id}
                    href={`/wholesale-orders/${order.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <div>
                      <p className="font-mono text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {order.customer.companyName || order.customer.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.className)}>
                        {cfg.label}
                      </span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">
                        {order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-200">Top Customers</h2>
            <Link
              href="/customers"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.topCustomers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-400">No wholesale customers yet.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.topCustomers.map((customer, idx) => (
                <div
                  key={customer.name}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 dark:bg-zinc-800">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {customer.companyName || customer.name}
                    </p>
                    {customer.companyName && (
                      <p className="text-xs text-zinc-400 truncate">{customer.name}</p>
                    )}
                  </div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm shrink-0">
                    {customer.totalSpent.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/wholesale-orders/new"
          className="flex items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-4 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400"
        >
          <Package className="h-5 w-5 shrink-0" />
          New Wholesale Order
        </Link>
        <Link
          href="/customers"
          className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors dark:border-zinc-700 dark:bg-zinc-800/20 dark:text-zinc-400"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          B2B Customers
        </Link>
      </div>
    </div>
  );
}
