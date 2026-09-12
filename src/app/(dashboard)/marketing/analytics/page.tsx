"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rfGetDashboard } from "@/lib/reachflow";

interface DashboardData {
  metrics: { reach: number; impressions: number; engagementRate: number; clicks: number };
  savings: { savedAmount: number; message: string };
}

const PERIOD_OPTIONS = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
] as const;

type Period = "7d" | "30d" | "90d";

const CPM_RATES: Array<{ platform: string; cpm: number }> = [
  { platform: "Meta", cpm: 8.50 },
  { platform: "Instagram", cpm: 6.70 },
  { platform: "TikTok", cpm: 3.21 },
  { platform: "X (Twitter)", cpm: 5.50 },
  { platform: "LinkedIn", cpm: 33.80 },
  { platform: "YouTube", cpm: 9.68 },
  { platform: "Pinterest", cpm: 1.50 },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function MarketingAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    rfGetDashboard(period).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [period]);

  const maxCpm = Math.max(...CPM_RATES.map((r) => r.cpm));
  const impressions = data?.metrics.impressions ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-rose-500" />
            Marketing Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Reach, impressions, engagement, and ad spend savings</p>
        </div>
        <div className="flex gap-1.5">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                period === p.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Reach", value: loading ? "—" : fmt(data?.metrics.reach ?? 0) },
          { label: "Impressions", value: loading ? "—" : fmt(data?.metrics.impressions ?? 0) },
          { label: "Clicks", value: loading ? "—" : fmt(data?.metrics.clicks ?? 0) },
          { label: "Engagement Rate", value: loading ? "—" : `${data?.metrics.engagementRate ?? 0}%` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Savings banner */}
      {data?.savings && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-5 py-4 flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
              PKR {data.savings.savedAmount.toLocaleString()} saved
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{data.savings.message}</p>
          </div>
        </div>
      )}

      {/* Platform savings breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-zinc-400" />
            Estimated Savings by Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-400 mb-4">
            Based on {fmt(impressions)} impressions × each platform&apos;s average CPM rate
          </p>
          <div className="space-y-3">
            {CPM_RATES.map(({ platform, cpm }) => {
              const saved = ((impressions / 1000) * cpm);
              const width = (cpm / maxCpm) * 100;
              return (
                <div key={platform} className="flex items-center gap-3">
                  <p className="w-28 text-xs text-zinc-700 dark:text-zinc-300 flex-shrink-0">{platform}</p>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="text-right flex-shrink-0 w-24">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">PKR {saved.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-zinc-400">CPM PKR {cpm}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
