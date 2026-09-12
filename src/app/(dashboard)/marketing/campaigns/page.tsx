"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio, Plus, BarChart3, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { rfListCampaigns, rfGetCampaignMetrics } from "@/lib/reachflow";

interface Campaign {
  id: string;
  name: string;
  status: string;
  platforms: string[];
}

const STATUS_ICON = {
  active: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  paused: <PauseCircle className="h-3.5 w-3.5 text-amber-500" />,
  cancelled: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

const STATUS_PILL: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function MetricsBadge({ id }: { id: string }) {
  const [reach, setReach] = useState<number | null>(null);

  useEffect(() => {
    rfGetCampaignMetrics(id).then((m) => setReach(m?.reach ?? null));
  }, [id]);

  if (reach === null) return null;
  return (
    <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
      <BarChart3 className="h-3 w-3" />
      {reach >= 1000 ? `${(reach / 1000).toFixed(1)}K` : reach} reach
    </span>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rfListCampaigns().then((data) => {
      setCampaigns(data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Radio className="h-6 w-6 text-violet-500" />
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Organic multi-platform marketing campaigns</p>
        </div>
        <Button asChild size="sm">
          <Link href="/marketing/campaigns/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Campaign
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Radio className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No campaigns yet</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
              Create your first campaign to start promoting products organically across social platforms.
            </p>
            <Button asChild size="sm" className="mt-1">
              <Link href="/marketing/campaigns/new">Create campaign</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {campaigns.map((c) => (
          <Card key={c.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{c.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${STATUS_PILL[c.status] ?? STATUS_PILL.paused}`}>
                    {STATUS_ICON[c.status as keyof typeof STATUS_ICON]}
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-zinc-400">{c.platforms.join(", ")}</p>
                  <MetricsBadge id={c.id} />
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/marketing/campaigns/${c.id}`}>View</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
