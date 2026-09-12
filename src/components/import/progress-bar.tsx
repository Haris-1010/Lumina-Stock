"use client";

import { Loader2 } from "lucide-react";

interface ProgressBarProps {
  processed: number;
  total: number;
  phase: string;
}

export function ProgressBar({ processed, total, phase }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="font-medium">{phase}</span>
        </div>
        <span className="text-zinc-500 tabular-nums">
          {processed.toLocaleString()} / {total.toLocaleString()} rows
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-400 text-right">{pct}%</p>
    </div>
  );
}
