"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Radio, Search, FileText, Mail, BarChart3,
  TrendingUp, ArrowRight, Zap, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  rfGetDashboard,
  rfGetInsights,
} from "@/lib/reachflow";

interface DashboardData {
  metrics: { reach: number; impressions: number; engagementRate: number; clicks: number };
  savings: { savedAmount: number; message: string };
}

interface InsightsData {
  wins: string[];
  warnings?: string[];
  nextAction: string;
  weeklyScore: number;
}

const SECTIONS = [
  { label: "SEO Tools", href: "/marketing/seo", icon: Search, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400", desc: "Audit pages, research keywords, score content" },
  { label: "Campaigns", href: "/marketing/campaigns", icon: Radio, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400", desc: "Create & track organic multi-platform campaigns" },
  { label: "Content Studio", href: "/marketing/content", icon: FileText, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", desc: "AI-generated posts, stories, and hashtags" },
  { label: "Email", href: "/marketing/email", icon: Mail, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400", desc: "Draft and send email campaigns" },
  { label: "Analytics", href: "/marketing/analytics", icon: BarChart3, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400", desc: "Reach, impressions, engagement & ad savings" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function MarketingHubPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    Promise.all([rfGetDashboard("30d"), rfGetInsights()]).then(([d, i]) => {
      if (!d && !i) setOffline(true);
      setDashboard(d);
      setInsights(i);
      setLoading(false);
    });
  }, []);

  const stats = [
    { label: "Reach", value: dashboard?.metrics.reach ?? 0 },
    { label: "Impressions", value: dashboard?.metrics.impressions ?? 0 },
    { label: "Clicks", value: dashboard?.metrics.clicks ?? 0 },
    { label: "Engagement", value: dashboard?.metrics.engagementRate ? `${dashboard.metrics.engagementRate}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Radio className="h-6 w-6 text-violet-500" />
            Marketing Hub
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Powered by ReachFlow — zero-cost organic marketing for your inventory
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/marketing/campaigns/new">
            <Zap className="h-4 w-4 mr-1.5" />
            New Campaign
          </Link>
        </Button>
      </div>

      {/* Offline banner */}
      {offline && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold">ReachFlow server not reachable</p>
            <p className="text-amber-600 dark:text-amber-400 mt-0.5">
              Start the ReachFlow server: <code className="font-mono">cd reachflow &amp;&amp; pnpm dev</code> — or set <code className="font-mono">REACHFLOW_BASE_URL</code> in your .env.local
            </p>
          </div>
        </div>
      )}

      {/* Savings banner */}
      {dashboard?.savings && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-4 py-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              PKR {dashboard.savings.savedAmount.toLocaleString()} saved vs. paid ads this month
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{dashboard.savings.message}</p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {loading ? <span className="text-zinc-300 dark:text-zinc-600">—</span> : (typeof s.value === "number" ? fmt(s.value) : s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((sec) => (
          <Link key={sec.href} href={sec.href} className="group">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-start gap-4">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${sec.color}`}>
                  <sec.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {sec.label}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{sec.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Insights */}
      {insights && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Weekly Insights
              <span className="ml-auto text-xs font-normal text-zinc-400">Score: {insights.weeklyScore}/100</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.wins.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">Wins</p>
                <ul className="space-y-1">
                  {insights.wins.map((w, i) => (
                    <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                      <span className="text-emerald-500 flex-shrink-0">✓</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.warnings && insights.warnings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">Warnings</p>
                <ul className="space-y-1">
                  {insights.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                      <span className="text-amber-500 flex-shrink-0">!</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-3 py-2">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Next action</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{insights.nextAction}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
