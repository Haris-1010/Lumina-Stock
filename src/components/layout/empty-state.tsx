"use client";

import { Package, Upload, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  showSampleCsv?: boolean;
  /** Show the full onboarding "getting started" steps */
  showOnboarding?: boolean;
}

function OnboardingSteps() {
  const steps = [
    {
      icon: Upload,
      title: "Import your products",
      description: "Upload a CSV or add products one by one.",
      href: "/settings",
      linkLabel: "Go to Settings → Data Import",
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      icon: Package,
      title: "Add your suppliers",
      description: "Link suppliers to products so auto-PO generation works.",
      href: "/suppliers",
      linkLabel: "Manage Suppliers",
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      icon: Plus,
      title: "Set reorder points",
      description: "Tell the system when to alert you for each product.",
      href: "/inventory",
      linkLabel: "Go to Inventory",
      color: "bg-amber-100 text-amber-600",
    },
    {
      icon: ArrowRight,
      title: "Run your first forecast",
      description: "AI will predict stockouts and suggest purchase quantities.",
      href: "/forecasts",
      linkLabel: "View Forecasts",
      color: "bg-blue-100 text-blue-600",
    },
  ];

  return (
    <div className="mt-8 w-full max-w-2xl">
      <p className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Get started in 4 steps
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {steps.map((step, i) => (
          <Link
            key={i}
            href={step.href}
            className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-emerald-800/60 dark:hover:bg-emerald-950/20"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step.color}`}>
              <step.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <span className="mr-1 text-xs font-normal text-zinc-400">{i + 1}.</span>
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{step.description}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600 group-hover:underline dark:text-emerald-400">
                {step.linkLabel} →
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action, showSampleCsv, showOnboarding }: EmptyStateProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-white/40 px-8 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <Package className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {action && (
          <Button onClick={action.onClick}>{action.label}</Button>
        )}
        {showSampleCsv && (
          <Button variant="outline" asChild>
            <a href="/api/csv-upload/sample" download>
              {t("emptyState.downloadSampleCsv")}
            </a>
          </Button>
        )}
      </div>
      {showOnboarding && <OnboardingSteps />}
    </div>
  );
}
