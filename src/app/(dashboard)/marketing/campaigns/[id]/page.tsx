"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Radio, ArrowLeft, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { rfGetCampaignMetrics } from "@/lib/reachflow";

interface Metrics {
  reach: number;
  impressions: number;
  engagementRate: number;
  clicks: number;
  platformBreakdown: Record<string, unknown>;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rfGetCampaignMetrics(id).then((m) => {
      setMetrics(m);
      setLoading(false);
    });
  }, [id]);

  const stats = metrics
    ? [
        { label: "Reach", value: fmt(metrics.reach) },
        { label: "Impressions", value: fmt(metrics.impressions) },
        { label: "Clicks", value: fmt(metrics.clicks) },
        { label: "Engagement", value: `${metrics.engagementRate}%` },
      ]
    : [];

  const breakdown = metrics?.platformBreakdown ?? {};

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/marketing/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Radio className="h-6 w-6 text-violet-500" />
            Campaign Metrics
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">ID: {id}</p>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !metrics && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No metrics available — campaign may not have started yet.
          </CardContent>
        </Card>
      )}

      {metrics && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {Object.keys(breakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-zinc-400" />
                  Platform Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {Object.entries(breakdown).map(([platform, data]) => (
                    <div key={platform} className="py-2.5 flex items-center justify-between gap-4">
                      <p className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">{platform}</p>
                      <pre className="text-xs text-zinc-400 font-mono">{JSON.stringify(data, null, 0)}</pre>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
