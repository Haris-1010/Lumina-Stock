"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type InsightTone = "emerald" | "amber";

interface AIInsightCardProps {
  title: string;
  content: string;
  openLabel: string;
  summaryPrefix?: string;
  dialogDescription?: string;
  tone?: InsightTone;
}

function summarize(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 150) return compact;
  return `${compact.slice(0, 147)}...`;
}

export function AIInsightCard({
  title,
  content,
  openLabel,
  summaryPrefix,
  dialogDescription,
  tone = "emerald",
}: AIInsightCardProps) {
  const summary = useMemo(() => summarize(content), [content]);

  const toneClasses =
    tone === "amber"
      ? {
          icon: "text-amber-600 dark:text-amber-400",
          title: "text-amber-900 dark:text-amber-200",
          summary: "text-amber-800/90 dark:text-amber-100/90",
          panel: "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20",
        }
      : {
          icon: "text-emerald-600 dark:text-emerald-400",
          title: "text-emerald-900 dark:text-emerald-200",
          summary: "text-emerald-800/90 dark:text-emerald-100/90",
          panel: "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20",
        };

  return (
    <Card className={toneClasses.panel}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className={`flex items-center gap-2 text-sm font-semibold ${toneClasses.title}`}>
            <Sparkles className={`h-4 w-4 ${toneClasses.icon}`} />
            {title}
          </p>
          <p className={`text-sm leading-relaxed ${toneClasses.summary}`}>
            {summaryPrefix ? `${summaryPrefix} ${summary}` : summary}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="shrink-0">
              {openLabel}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {dialogDescription ? (
                <DialogDescription>{dialogDescription}</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed whitespace-pre-line dark:border-zinc-700 dark:bg-zinc-800/50">
              {content}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
