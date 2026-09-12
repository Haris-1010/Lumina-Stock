"use client";

import { useState, useTransition } from "react";
import { Store, Package, ChevronDown } from "lucide-react";
import { setActiveModeForCurrentOrganization } from "@/lib/actions/wholesale";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
  activeMode: "RETAIL" | "WHOLESALE";
}

export function ModeToggle({ activeMode }: ModeToggleProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function switchMode(mode: "RETAIL" | "WHOLESALE") {
    if (mode === activeMode) { setOpen(false); return; }
    setOpen(false);
    startTransition(async () => {
      await setActiveModeForCurrentOrganization(mode);
    });
  }

  const isRetail = activeMode === "RETAIL";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
          "border border-zinc-200 dark:border-zinc-700",
          "hover:bg-zinc-50 dark:hover:bg-zinc-800",
          isPending && "opacity-60 cursor-wait"
        )}
      >
        {isRetail ? (
          <Store className="h-4 w-4 text-emerald-500 shrink-0" />
        ) : (
          <Package className="h-4 w-4 text-blue-500 shrink-0" />
        )}
        <span className="flex-1 text-left text-zinc-700 dark:text-zinc-300">
          {isRetail ? "Retail mode" : "Wholesale mode"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden z-50">
          <button
            type="button"
            onClick={() => switchMode("RETAIL")}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800",
              activeMode === "RETAIL" && "bg-emerald-50 dark:bg-emerald-950/30"
            )}
          >
            <Store className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="text-left">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">Retail</p>
              <p className="text-[10px] text-zinc-400">POS, sales, customers</p>
            </div>
            {activeMode === "RETAIL" && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => switchMode("WHOLESALE")}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800",
              activeMode === "WHOLESALE" && "bg-blue-50 dark:bg-blue-950/30"
            )}
          >
            <Package className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="text-left">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">Wholesale</p>
              <p className="text-[10px] text-zinc-400">B2B orders, pricing tiers</p>
            </div>
            {activeMode === "WHOLESALE" && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
