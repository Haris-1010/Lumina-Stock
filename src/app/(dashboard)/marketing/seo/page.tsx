"use client";

import { useState } from "react";
import { Search, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rfRunSEOAudit, rfResearchKeywords, rfScoreContent } from "@/lib/reachflow";

interface AuditIssue { severity: string; message: string; fix?: string }
interface AuditResult {
  url: string; score: number; issues: AuditIssue[];
  coreWebVitals?: { lcp: number; fid: number; cls: number };
}
interface Keyword { keyword: string; volume: number; difficulty: number; intent: string }

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
  warning: "border-l-amber-400 bg-amber-50 dark:bg-amber-950/20",
  info: "border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />,
  warning: <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />,
  info: <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />,
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-red-500";
  return (
    <div className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${score >= 80 ? "border-emerald-200 dark:border-emerald-900" : score >= 60 ? "border-amber-200 dark:border-amber-900" : "border-red-200 dark:border-red-900"}`}>
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
    </div>
  );
}

export default function SEOPage() {
  const [auditUrl, setAuditUrl] = useState("");
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);

  const [kwQuery, setKwQuery] = useState("");
  const [loadingKw, setLoadingKw] = useState(false);
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  const [scoreContent, setScoreContent] = useState("");
  const [scoreKw, setScoreKw] = useState("");
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ overallScore: number; readabilityScore: number; keywordDensity: number; suggestions: string[] } | null>(null);

  const runAudit = async () => {
    if (!auditUrl.trim()) return;
    setAuditing(true);
    const result = await rfRunSEOAudit(auditUrl.trim());
    setAudit(result);
    setAuditing(false);
  };

  const researchKeywords = async () => {
    if (!kwQuery.trim()) return;
    setLoadingKw(true);
    const result = await rfResearchKeywords(kwQuery.trim());
    setKeywords(result ?? []);
    setLoadingKw(false);
  };

  const runScoreContent = async () => {
    if (!scoreContent.trim()) return;
    setScoring(true);
    const result = await rfScoreContent(scoreContent.trim(), scoreKw.trim() || undefined);
    setScoreResult(result);
    setScoring(false);
  };

  const criticals = audit?.issues.filter((i) => i.severity === "critical").length ?? 0;
  const warnings = audit?.issues.filter((i) => i.severity === "warning").length ?? 0;
  const infos = audit?.issues.filter((i) => i.severity === "info").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Search className="h-6 w-6 text-blue-500" />
          SEO Tools
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Audit pages, research keywords, and score your content</p>
      </div>

      {/* Site Audit */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Site Audit</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder="https://yoursite.com" className="flex-1" />
            <Button onClick={runAudit} disabled={auditing} size="sm">
              {auditing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Audit
            </Button>
          </div>

          {audit && (
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <ScoreRing score={audit.score} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{audit.url}</p>
                  <div className="flex gap-4 text-xs">
                    <span className="text-red-600 dark:text-red-400">{criticals} critical</span>
                    <span className="text-amber-600 dark:text-amber-400">{warnings} warnings</span>
                    <span className="text-blue-600 dark:text-blue-400">{infos} info</span>
                  </div>
                  {audit.coreWebVitals && (
                    <div className="flex gap-4 text-[11px] text-zinc-400">
                      <span>LCP {audit.coreWebVitals.lcp}s</span>
                      <span>FID {audit.coreWebVitals.fid}ms</span>
                      <span>CLS {audit.coreWebVitals.cls}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {audit.issues.map((issue, i) => (
                  <div key={i} className={`rounded-r-lg border-l-4 px-3 py-2 ${SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.info}`}>
                    <div className="flex items-start gap-2">
                      {SEVERITY_ICON[issue.severity] ?? SEVERITY_ICON.info}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-700 dark:text-zinc-300">{issue.message}</p>
                        {issue.fix && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{issue.fix}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                {audit.issues.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> No issues found — great SEO health!
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyword Research */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Keyword Research</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={kwQuery} onChange={(e) => setKwQuery(e.target.value)} placeholder="e.g. wireless headphones" className="flex-1" />
            <Button onClick={researchKeywords} disabled={loadingKw} size="sm" variant="outline">
              {loadingKw && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Research
            </Button>
          </div>

          {keywords.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left py-2 text-zinc-400 font-medium">Keyword</th>
                    <th className="text-right py-2 text-zinc-400 font-medium">Volume</th>
                    <th className="text-right py-2 text-zinc-400 font-medium">Difficulty</th>
                    <th className="text-right py-2 text-zinc-400 font-medium">Intent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                  {keywords.map((kw) => (
                    <tr key={kw.keyword}>
                      <td className="py-2 text-zinc-700 dark:text-zinc-300 font-medium">{kw.keyword}</td>
                      <td className="py-2 text-right text-zinc-500">{kw.volume.toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${kw.difficulty >= 70 ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" : kw.difficulty >= 40 ? "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"}`}>{kw.difficulty}</span>
                      </td>
                      <td className="py-2 text-right text-zinc-400 capitalize">{kw.intent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Scorer */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Content Score</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Content</label>
            <textarea
              value={scoreContent}
              onChange={(e) => setScoreContent(e.target.value)}
              rows={5}
              placeholder="Paste your page content or blog post…"
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">Target Keyword (optional)</label>
            <Input value={scoreKw} onChange={(e) => setScoreKw(e.target.value)} placeholder="e.g. wireless headphones" />
          </div>
          <Button onClick={runScoreContent} disabled={scoring} size="sm" variant="outline">
            {scoring && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Score Content
          </Button>

          {scoreResult && (
            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
              {[
                { label: "Overall", value: `${scoreResult.overallScore}/100` },
                { label: "Readability", value: `${scoreResult.readabilityScore}/100` },
                { label: "Keyword Density", value: `${scoreResult.keywordDensity}%` },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-3 py-2 text-center">
                  <p className="text-[10px] text-zinc-400">{s.label}</p>
                  <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{s.value}</p>
                </div>
              ))}
              {scoreResult.suggestions.length > 0 && (
                <div className="col-span-3 space-y-1">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Suggestions</p>
                  {scoreResult.suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-1.5">
                      <span className="text-blue-400 flex-shrink-0">›</span> {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
