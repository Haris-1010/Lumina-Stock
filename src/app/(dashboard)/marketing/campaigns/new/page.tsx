"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rfCreateCampaign } from "@/lib/reachflow";

const PLATFORMS = ["instagram", "meta", "tiktok", "x", "linkedin", "youtube", "pinterest"];
const CONTENT_TYPES = ["post", "story", "reel", "carousel", "email"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("ecommerce");
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "meta"]);
  const [contentTypes, setContentTypes] = useState<string[]>(["post", "story"]);
  const [reach, setReach] = useState(5000);
  const [engagement, setEngagement] = useState(3);
  const [conversions, setConversions] = useState(50);
  const [duration, setDuration] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Campaign name is required"); return; }
    if (platforms.length === 0) { setError("Select at least one platform"); return; }
    setSaving(true);
    setError("");
    const result = await rfCreateCampaign({
      name: name.trim(),
      niche,
      platforms,
      contentTypes,
      goals: { reach, engagementRate: engagement, conversions },
      budget: 0,
      duration,
      hashtags: [],
      keywords: [],
    });
    if (result?.id) {
      router.push(`/marketing/campaigns/${result.id}`);
    } else {
      setError("Failed to create campaign — is the ReachFlow server running?");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/marketing/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Radio className="h-6 w-6 text-violet-500" />
            New Campaign
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Launch an organic multi-platform campaign</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Campaign Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Campaign Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Clearance Sale" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Niche</label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="ecommerce, fashion, electronics…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Platforms</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggle(platforms, p, setPlatforms)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    platforms.includes(p)
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Content Types</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => toggle(contentTypes, ct, setContentTypes)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    contentTypes.includes(ct)
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  {ct}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Goals</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Reach</label>
              <Input type="number" value={reach} onChange={(e) => setReach(Number(e.target.value))} min={0} />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Engagement %</label>
              <Input type="number" value={engagement} onChange={(e) => setEngagement(Number(e.target.value))} min={0} step={0.1} />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Conversions</label>
              <Input type="number" value={conversions} onChange={(e) => setConversions(Number(e.target.value))} min={0} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Duration</CardTitle></CardHeader>
          <CardContent>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Duration (days)</label>
            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={1} max={365} className="max-w-xs" />
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" asChild>
            <Link href="/marketing/campaigns">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Launch Campaign
          </Button>
        </div>
      </form>
    </div>
  );
}
