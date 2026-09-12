"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HelpSection {
  title: string;
  items: string[];
}

export interface PageHelpProps {
  title: string;
  purpose: string;
  sections: HelpSection[];
  aiTips?: string[];
}

export function PageHelp({ title, purpose, sections, aiTips }: PageHelpProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-7 rounded-full border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
        title="Page guide"
        aria-label="Open page guide"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">{title}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {/* Purpose */}
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{purpose}</p>
            </div>

            {/* Sections */}
            {sections.map((section, i) => (
              <div key={i} className="px-4 py-3 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{section.title}</p>
                <ul className="space-y-1.5">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* AI Tips */}
            {aiTips && aiTips.length > 0 && (
              <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-950/20">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">💡 Ask the AI Assistant</p>
                <ul className="space-y-1.5">
                  {aiTips.map((tip, i) => (
                    <li key={i} className="text-xs text-blue-600 dark:text-blue-400 italic">"{tip}"</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
