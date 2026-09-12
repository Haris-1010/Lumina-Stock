"use client";

import { useState } from "react";
import { FileText, Loader2, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rfGenerateContent, rfGetHashtags } from "@/lib/reachflow";

const PLATFORMS = ["instagram", "linkedin", "tiktok", "x", "meta", "pinterest"];
const INTENTS = ["promote", "educate", "entertain", "engage"];
const TONES = ["professional", "casual", "playful", "urgent"];

export default function ContentStudioPage() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [intent, setIntent] = useState("promote");
  const [tone, setTone] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<{ content: string; hashtags: string[]; seoScore: number } | null>(null);
  const [hashtagTopic, setHashtagTopic] = useState("");
  const [hashtagPlatforms, setHashtagPlatforms] = useState<string[]>(["instagram"]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const [hashtags, setHashtags] = useState<{ primary: string[]; secondary: string[]; niche: string[] } | null>(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) { setError("Enter a topic first"); return; }
    setGenerating(true);
    setError("");
    const result = await rfGenerateContent({ topic, platform, intent, tone });
    if (result) {
      setContent(result);
    } else {
      setError("Could not generate content — is the ReachFlow server running?");
    }
    setGenerating(false);
  };

  const handleHashtags = async () => {
    if (!hashtagTopic.trim()) return;
    setLoadingHashtags(true);
    const result = await rfGetHashtags({ topic: hashtagTopic, niche: "ecommerce", platforms: hashtagPlatforms });
    setHashtags(result);
    setLoadingHashtags(false);
  };

  const togglePlatform = (p: string) =>
    setHashtagPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <FileText className="h-6 w-6 text-emerald-500" />
          Content Studio
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">AI-generated platform-optimised content powered by Claude</p>
      </div>

      {/* Content Generator */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Generate Content</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Topic</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Summer clearance sale on electronics" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button key={p} type="button" onClick={() => setPlatform(p)}
                    className={`rounded px-2 py-1 text-[10px] font-medium capitalize transition-all ${platform === p ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                  >{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Intent</label>
              <div className="flex flex-wrap gap-1.5">
                {INTENTS.map((i) => (
                  <button key={i} type="button" onClick={() => setIntent(i)}
                    className={`rounded px-2 py-1 text-[10px] font-medium capitalize transition-all ${intent === i ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                  >{i}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Tone</label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button key={t} type="button" onClick={() => setTone(t)}
                    className={`rounded px-2 py-1 text-[10px] font-medium capitalize transition-all ${tone === t ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <Button onClick={handleGenerate} disabled={generating} size="sm">
            {generating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Generate
          </Button>

          {content && (
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Generated Content</label>
                  <span className="text-[10px] text-zinc-400">SEO Score: {content.seoScore}/100</span>
                </div>
                <Textarea value={content.content} readOnly rows={6} className="text-sm font-mono resize-none" />
              </div>
              {content.hashtags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {content.hashtags.map((h) => (
                      <span key={h} className="rounded px-2 py-0.5 text-[10px] bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-mono">{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hashtag Research */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Hash className="h-4 w-4 text-zinc-400" />
            Hashtag Research
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Topic</label>
            <Input value={hashtagTopic} onChange={(e) => setHashtagTopic(e.target.value)} placeholder="e.g. summer fashion" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button key={p} type="button" onClick={() => togglePlatform(p)}
                  className={`rounded px-2 py-1 text-[10px] font-medium capitalize transition-all ${hashtagPlatforms.includes(p) ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                >{p}</button>
              ))}
            </div>
          </div>
          <Button onClick={handleHashtags} disabled={loadingHashtags} size="sm" variant="outline">
            {loadingHashtags && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Research Hashtags
          </Button>

          {hashtags && (
            <div className="space-y-3 pt-1">
              {(["primary", "secondary", "niche"] as const).map((group) => (
                hashtags[group].length > 0 && (
                  <div key={group}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 capitalize">{group}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hashtags[group].map((h) => (
                        <span key={h} className="rounded px-2 py-0.5 text-[10px] bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 font-mono">{h}</span>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
