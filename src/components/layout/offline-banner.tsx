"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { WifiOff, Wifi, Loader2, CheckCircle2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  getPendingSales,
  getPendingPOs,
  removePendingSale,
  removePendingPO,
  totalPendingCount,
} from "@/lib/offline-storage";
import { completeCashierSaleForCurrentOrganization } from "@/lib/actions/cashier";
import { generatePurchaseOrder } from "@/lib/actions/purchase-orders";

type SyncState = "idle" | "syncing" | "done";

export function OfflineBanner() {
  // Suppress all rendering until after hydration — navigator.onLine is
  // undefined on the server so the initial server HTML is always "null".
  // Without this guard the client render differs and React throws a
  // hydration mismatch error.
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-read pending count whenever the component re-renders
  useEffect(() => {
    if (!mounted) return;
    const update = () => setPending(totalPendingCount());
    update();

    // Also listen for storage events from other tabs
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [mounted]);

  const syncAll = useCallback(() => {
    const sales = getPendingSales();
    const pos = getPendingPOs();

    if (sales.length === 0 && pos.length === 0) return;

    setSyncState("syncing");

    startTransition(async () => {
      let remaining = sales.length + pos.length;

      // Sync pending sales
      for (const sale of sales) {
        try {
          const result = await completeCashierSaleForCurrentOrganization({
            items: sale.items,
          });
          if (!result.error) {
            removePendingSale(sale.id);
            remaining--;
          }
        } catch {
          // leave it for next retry
        }
      }

      // Sync pending purchase orders
      for (const po of pos) {
        try {
          await generatePurchaseOrder(po.organizationId, po.supplierId, po.lines);
          removePendingPO(po.id);
          remaining--;
        } catch {
          // leave it for next retry
        }
      }

      setPending(totalPendingCount());
      setSyncState(remaining === 0 ? "done" : "idle");

      if (remaining === 0) {
        // Auto-hide the "done" state after 3 s, then reload to reflect synced data
        setTimeout(() => {
          setSyncState("idle");
          window.location.reload();
        }, 3000);
      }
    });
  }, []);

  const isOnline = useOnlineStatus(syncAll);

  // When we come back online — syncAll is called by useOnlineStatus callback.
  // Also update pending count whenever online status changes.
  useEffect(() => {
    if (mounted) setPending(totalPendingCount());
  }, [isOnline, mounted]);

  // Render nothing until the client has mounted — avoids hydration mismatch
  if (!mounted) return null;

  // Nothing to show when online and no pending items
  if (isOnline && pending === 0 && syncState === "idle") return null;

  if (isOnline && syncState === "done") {
    return (
      <div className="flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-xs font-medium text-white">
        <CheckCircle2 className="h-3.5 w-3.5" />
        All offline data synced successfully.
      </div>
    );
  }

  if (isOnline && (syncState === "syncing" || isPending)) {
    return (
      <div className="flex items-center justify-center gap-2 bg-blue-600 px-4 py-2 text-xs font-medium text-white">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Syncing {pending} offline record{pending !== 1 ? "s" : ""}…
      </div>
    );
  }

  if (isOnline && pending > 0) {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-medium text-white">
        <Wifi className="h-3.5 w-3.5" />
        Back online — {pending} record{pending !== 1 ? "s" : ""} pending sync.
        <button
          onClick={syncAll}
          className="ml-1 rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          Sync now
        </button>
      </div>
    );
  }

  // Offline
  return (
    <div className="flex items-center justify-center gap-2 bg-zinc-800 px-4 py-2 text-xs font-medium text-white">
      <WifiOff className="h-3.5 w-3.5" />
      You are offline.
      {pending > 0 && (
        <span className="ml-1 rounded bg-white/20 px-2 py-0.5">
          {pending} record{pending !== 1 ? "s" : ""} queued for sync
        </span>
      )}
    </div>
  );
}
