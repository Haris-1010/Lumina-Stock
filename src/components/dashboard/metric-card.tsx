import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color: "emerald" | "green" | "red" | "amber" | "blue";
}

const colorMap = {
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-100 dark:ring-emerald-900/40" },
  green:   { bg: "bg-green-50 dark:bg-green-950/30",   icon: "text-green-600 dark:text-green-400",   ring: "ring-green-100 dark:ring-green-900/40" },
  red:     { bg: "bg-red-50 dark:bg-red-950/30",       icon: "text-red-600 dark:text-red-400",       ring: "ring-red-100 dark:ring-red-900/40" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/30",   icon: "text-amber-600 dark:text-amber-400",   ring: "ring-amber-100 dark:ring-amber-900/40" },
  blue:    { bg: "bg-blue-50 dark:bg-blue-950/30",     icon: "text-blue-600 dark:text-blue-400",     ring: "ring-blue-100 dark:ring-blue-900/40" },
};

export function MetricCard({ title, value, icon: Icon, trend, trendUp, color }: MetricCardProps) {
  const colors = colorMap[color];

  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 break-words">{title}</p>
          <p className="mt-2 break-all text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{value}</p>
          {trend && (
            <p className={cn("mt-1.5 text-xs font-medium", trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500")}>
              {trend}
            </p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", colors.bg, colors.ring)}>
          <Icon className={cn("h-5 w-5", colors.icon)} />
        </div>
      </div>
    </div>
  );
}
