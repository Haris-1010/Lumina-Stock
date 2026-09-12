"use client";

import { useState, useRef } from "react";
import {
  Megaphone, Sparkles, Target, BarChart3, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, ChevronUp,
  ImageIcon, VideoIcon, Type, Upload, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "meta" | "google" | "tiktok" | "linkedin" | "x";
type ContentType = "text" | "image" | "video";

interface ContentReport {
  valid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

interface AdVariant {
  id: string;
  fitness: number;
  generation: number;
  reasoning: string;
  chromosome: {
    headline: string;
    body: string;
    cta: string;
    platform: string;
    colorScheme: string;
    bidAmount: number;
    scheduledTime: string;
    audienceSegment: string;
    imageVariant: string;
  };
}

interface CampaignResult {
  campaignId: string;
  status: string;
  estimatedStart: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta (Facebook/Instagram)",
  google: "Google Ads",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  meta: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  google: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  tiktok: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  linkedin: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  x: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const CONTENT_TYPES: { value: ContentType; label: string; icon: React.ElementType; hint: string }[] = [
  { value: "text", label: "Text", icon: Type, hint: "Write or paste your ad copy" },
  { value: "image", label: "Image", icon: ImageIcon, hint: "Upload a JPG or PNG creative (max 10 MB)" },
  { value: "video", label: "Video", icon: VideoIcon, hint: "Paste a video URL (MP4, YouTube, Vimeo)" },
];

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdPromotionsPage() {
  // ── Content state ───────────────────────────────────────────────────
  const [contentType, setContentType] = useState<ContentType>("text");
  const [adText, setAdText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDescription, setVideoDescription] = useState("");

  // ── Targeting state ─────────────────────────────────────────────────
  const [niche, setNiche] = useState("");
  const [budget, setBudget] = useState("500");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["meta", "google"]);
  const [intent, setIntent] = useState("purchase");

  // ── Result state ─────────────────────────────────────────────────────
  const [contentReport, setContentReport] = useState<ContentReport | null>(null);
  const [variants, setVariants] = useState<AdVariant[]>([]);
  const [campaign, setCampaign] = useState<CampaignResult | null>(null);
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────
  const [loadingValidate, setLoadingValidate] = useState(false);
  const [loadingOptimize, setLoadingOptimize] = useState(false);
  const [loadingLaunch, setLoadingLaunch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const BASE = "/api/adevolve";

  // ── Helpers ───────────────────────────────────────────────────────────

  const post = async <T,>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);
    return json as T;
  };

  const buildContentPayload = () => {
    if (contentType === "text") return { type: "text" as const, content: adText };
    if (contentType === "image") return {
      type: "image" as const,
      content: imageData ?? "",
      metadata: { fileName: imageName, description: imageDescription },
    };
    return { type: "video" as const, content: videoUrl, metadata: { description: videoDescription } };
  };

  const hasContent = () => {
    if (contentType === "text") return adText.trim().length > 0;
    if (contentType === "image") return imageData !== null;
    return videoUrl.trim().length > 0;
  };

  // ── Image upload ──────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Image must be under 10 MB."); return; }
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setImageData(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Actions ───────────────────────────────────────────────────────────

  const handleValidate = async () => {
    if (!hasContent()) { setError("Add content first."); return; }
    setError(null);
    setLoadingValidate(true);
    try {
      const report = await post<ContentReport>("/validate", { content: buildContentPayload() });
      setContentReport(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setLoadingValidate(false);
    }
  };

  const handleOptimize = async () => {
    if (!hasContent() || !niche.trim()) {
      setError("Add content and a niche before optimizing.");
      return;
    }
    setError(null);
    setVariants([]);
    setLoadingOptimize(true);
    try {
      const result = await post<{ variants: AdVariant[]; generationsRun: number; topFitness: number; contentReport: ContentReport }>("/optimize", {
        content: buildContentPayload(),
        targeting: {
          niche,
          ageRange: [22, 55],
          interests: [niche],
          locations: ["US", "UK"],
          intent,
          budget: parseFloat(budget) || 500,
          currency: "PKR",
        },
        platforms: selectedPlatforms,
        generations: 10,
      });
      setVariants(result.variants);
      setContentReport(result.contentReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      setLoadingOptimize(false);
    }
  };

  const handleLaunch = async () => {
    if (!hasContent() || !niche.trim()) {
      setError("Complete the form before launching.");
      return;
    }
    setError(null);
    setLoadingLaunch(true);
    try {
      const result = await post<CampaignResult>("/campaign", {
        content: buildContentPayload(),
        targeting: {
          niche,
          ageRange: [22, 55],
          interests: [niche],
          locations: ["US", "UK"],
          intent,
          budget: parseFloat(budget) || 500,
          currency: "PKR",
        },
        platforms: selectedPlatforms,
        budget: parseFloat(budget) || 500,
      });
      setCampaign(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setLoadingLaunch(false);
    }
  };

  const togglePlatform = (p: Platform) =>
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );

  const clearImage = () => {
    setImageData(null);
    setImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-zinc-500" />
          Ad Promotions
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          AI-powered ad engine — validate content, evolve variants with a Genetic Algorithm, and launch multi-platform campaigns.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button className="ml-auto text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Input Form ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-zinc-400" />
              Ad Content & Targeting
            </CardTitle>
            <CardDescription>
              Choose text, image, or video — the AI evolves the best-performing variants for each platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Content type tabs */}
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-2">Content Type</label>
              <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1 bg-zinc-50 dark:bg-zinc-900">
                {CONTENT_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setContentType(value); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all ${
                      contentType === value
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                {CONTENT_TYPES.find(c => c.value === contentType)?.hint}
              </p>
            </div>

            {/* Content input — Text */}
            {contentType === "text" && (
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ad Copy / Product Description</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                  rows={4}
                  placeholder="e.g. Discover the fastest way to manage your inventory with AI-powered insights. Try free for 14 days."
                  value={adText}
                  onChange={(e) => setAdText(e.target.value)}
                />
              </div>
            )}

            {/* Content input — Image */}
            {contentType === "image" && (
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Upload Image Creative</label>
                {!imageData ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1 w-full rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700 px-4 py-8 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
                  >
                    <Upload className="h-6 w-6" />
                    <span className="text-xs">Click to upload — JPG, PNG, GIF (max 10 MB)</span>
                  </button>
                ) : (
                  <div className="mt-1 relative rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageData} alt="Ad creative" className="w-full max-h-48 object-cover" />
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
                      <span className="text-xs text-zinc-500 truncate">{imageName}</span>
                      <button onClick={clearImage} className="ml-2 text-zinc-400 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="mt-3">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Caption / Description</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                    rows={3}
                    placeholder="Describe this image — what product it shows, the mood, the offer. The AI uses this to generate better ad copy."
                    value={imageDescription}
                    onChange={(e) => setImageDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Content input — Video */}
            {contentType === "video" && (
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Video URL</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  placeholder="https://youtu.be/... or https://vimeo.com/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  MP4 direct links, YouTube, or Vimeo URLs. The engine validates duration, resolution, and platform compliance.
                </p>
                <div className="mt-3">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Video Description</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
                    rows={3}
                    placeholder="Describe this video — what it shows, the hook, the product, the offer. The AI uses this to generate matching ad copy variants."
                    value={videoDescription}
                    onChange={(e) => setVideoDescription(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Niche + Budget */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Niche / Industry</label>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  placeholder="e.g. inventory software"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Budget (PKR)
                  <span className="ml-1 text-zinc-400 font-normal">— total campaign spend cap</span>
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  placeholder="500"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
            </div>

            {/* Intent */}
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Campaign Intent</label>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
              >
                <option value="purchase">Purchase / Buy</option>
                <option value="trial">Free Trial / Sign-up</option>
                <option value="awareness">Brand Awareness</option>
                <option value="lead-generation">Lead Generation</option>
                <option value="subscription">Subscription</option>
              </select>
            </div>

            {/* Platforms */}
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-2">Target Platforms</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                      selectedPlatforms.includes(p)
                        ? PLATFORM_COLORS[p] + " border-current"
                        : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {p === "meta" ? "Meta" : p === "google" ? "Google" : p === "tiktok" ? "TikTok" : p === "linkedin" ? "LinkedIn" : "X"}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={loadingValidate || !hasContent()}
              >
                {loadingValidate ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Validate
              </Button>
              <Button
                size="sm"
                onClick={handleOptimize}
                disabled={loadingOptimize || !hasContent() || !niche.trim()}
              >
                {loadingOptimize ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                {loadingOptimize ? "Evolving variants…" : "Optimize with AI"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLaunch}
                disabled={loadingLaunch || !hasContent() || !niche.trim() || selectedPlatforms.length === 0}
              >
                {loadingLaunch ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Target className="h-3.5 w-3.5 mr-1" />}
                {loadingLaunch ? "Launching…" : "Launch Campaign"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Content Report ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-zinc-400" />
              Content Quality Report
            </CardTitle>
            <CardDescription>Live analysis of your ad content quality and platform compliance.</CardDescription>
          </CardHeader>
          <CardContent>
            {!contentReport ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-zinc-400">
                <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                Click <strong className="mx-1">Validate</strong> or <strong className="mx-1">Optimize</strong> to see a quality report.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Quality Score</span>
                  <span className={`text-3xl font-bold ${scoreColor(contentReport.score)}`}>
                    {contentReport.score}<span className="text-base font-normal text-zinc-400">/100</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${contentReport.score >= 75 ? "bg-emerald-500" : contentReport.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${contentReport.score}%` }}
                  />
                </div>

                <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${contentReport.valid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                  {contentReport.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {contentReport.valid ? "Passed — ready to run" : "Needs attention"}
                </div>

                {contentReport.issues.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Issues</p>
                    <ul className="space-y-1">
                      {contentReport.issues.map((issue, i) => (
                        <li key={i} className="flex gap-2 text-xs text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />{issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {contentReport.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">Suggestions</p>
                    <ul className="space-y-1">
                      {contentReport.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-emerald-500" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Evolved Variants ── */}
      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-zinc-400" />
              Top 3 Evolved Ad Variants
            </CardTitle>
            <CardDescription>
              Generated by the Genetic Algorithm across {variants[0]?.generation ?? "?"} generations.
              Fitness = predicted CTR × audience match × platform relevance × content quality.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {variants.map((v, i) => (
              <div key={v.id} className="rounded-lg border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                  onClick={() => setExpandedVariant(expandedVariant === v.id ? null : v.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {v.chromosome.headline}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className={`text-sm font-bold ${scoreColor(v.fitness * 100)}`}>
                      {(v.fitness * 100).toFixed(1)}%
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PLATFORM_COLORS[v.chromosome.platform as Platform] ?? ""}`}>
                      {v.chromosome.platform}
                    </span>
                    {expandedVariant === v.id
                      ? <ChevronUp className="h-4 w-4 text-zinc-400" />
                      : <ChevronDown className="h-4 w-4 text-zinc-400" />
                    }
                  </div>
                </button>

                {expandedVariant === v.id && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Body</p>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{v.chromosome.body}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-zinc-400 font-medium">CTA</p>
                        <p className="text-zinc-700 dark:text-zinc-300 font-medium">{v.chromosome.cta}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 font-medium">Color Scheme</p>
                        <p className="text-zinc-700 dark:text-zinc-300 capitalize">{v.chromosome.colorScheme}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 font-medium">Bid Amount</p>
                        <p className="text-zinc-700 dark:text-zinc-300">PKR {v.chromosome.bidAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 font-medium">Scheduled</p>
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {new Date(v.chromosome.scheduledTime).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">AI Reasoning</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 capitalize">{v.reasoning}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Campaign launched ── */}
      {campaign && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Campaign Queued Successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-zinc-500 w-32">Campaign ID</span>
              <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all">{campaign.campaignId}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-32">Status</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 capitalize">
                {campaign.status}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-zinc-500 w-32">Estimated Start</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {new Date(campaign.estimatedStart).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Pipeline: validate → optimize → target → deliver → monitor.
              Poll status at <code className="font-mono">/api/adevolve/campaign/{campaign.campaignId}</code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
