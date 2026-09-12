"use client";

import { useState } from "react";
import { Check, ChevronRight, AlertCircle, Lightbulb } from "lucide-react";
import { getNicheConfig } from "@/lib/niche-config";
import { cn } from "@/lib/utils";

interface NicheSettingsState {
  features: Record<string, boolean>;
  taxRate: number;
}

interface StepNicheSettingsProps {
  nicheKey: string;
  language: string;
  value: NicheSettingsState;
  onChange: (value: NicheSettingsState) => void;
}

export function StepNicheSettings({ nicheKey, language, value, onChange }: StepNicheSettingsProps) {
  const isUr = language === "ur";
  const config = getNicheConfig(nicheKey);

  const [taxRate, setTaxRate] = useState<string>(String(value.taxRate ?? config.suggestedTaxRate));

  function toggleFeature(key: string, required?: boolean) {
    if (required) return;
    const next = { ...value.features, [key]: !value.features[key] };
    onChange({ ...value, features: next });
  }

  function handleTaxRateChange(raw: string) {
    setTaxRate(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onChange({ ...value, taxRate: parsed });
    }
  }

  return (
    <div className="space-y-5">
      {/* Business tip */}
      <div className="flex gap-3 rounded-xl border border-amber-200/60 dark:border-amber-700/40 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-800 dark:text-amber-300 leading-relaxed">
          {isUr ? config.businessTipUr : config.businessTip}
        </p>
      </div>

      {/* Features */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {isUr ? "اپنے کاروبار کی خصوصیات فعال کریں" : "Enable features for your business"}
        </h3>

        {config.features.map((feature) => {
          const isOn = value.features[feature.key] ?? feature.defaultOn;

          return (
            <button
              key={feature.key}
              type="button"
              onClick={() => toggleFeature(feature.key, feature.required)}
              className={cn(
                "w-full flex items-start gap-3.5 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-150",
                isOn
                  ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/30"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-600",
                feature.required && "cursor-default opacity-90"
              )}
            >
              {/* Toggle checkbox */}
              <div className={cn(
                "flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded-full border-2 transition-all",
                isOn
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
              )}>
                {isOn && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base leading-none">{feature.icon}</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    isOn ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"
                  )}>
                    {isUr ? feature.labelUr : feature.label}
                  </span>
                  {feature.required && (
                    <span className="rounded-full bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                      {isUr ? "لازمی" : "Required"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {isUr ? feature.descriptionUr : feature.description}
                </p>
                {isOn && (
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {feature.businessImpact}
                  </p>
                )}
              </div>

              {/* Enabled badge */}
              {isOn && (
                <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide self-start mt-1">
                  {isUr ? "فعال" : "ON"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tax rate config */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🧾</span>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isUr ? "ڈیفالٹ ٹیکس ریٹ" : "Default Tax Rate"}
          </h3>
          {config.suggestedTaxRate > 0 && (
            <span className="ml-auto text-[11px] text-zinc-400">
              {isUr ? "تجویز کردہ" : "Suggested"}: {config.suggestedTaxRate}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={taxRate}
            onChange={(e) => handleTaxRateChange(e.target.value)}
            className="w-24 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none"
          />
          <span className="text-sm text-zinc-500">%</span>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 ml-1">
            {isUr
              ? "یہ آپ کے انوائسز میں خودکار شامل ہوگا"
              : "Applied automatically on invoices. Can be overridden per order."}
          </p>
        </div>

        {config.suggestedTaxRate === 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-500">
              {isUr
                ? "آپ کی نوع کی اشیاء عام طور پر ٹیکس فری ہوتی ہیں۔ اپنے اکاؤنٹنٹ سے تصدیق کریں۔"
                : "Products in this niche are typically tax-exempt. Confirm with your accountant."}
            </p>
          </div>
        )}
      </div>

      {/* Companies preview */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            {isUr ? "پروڈکٹ کمپنیاں" : "Your product companies"}
          </h3>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {config.categories.map((cat) => (
            <span
              key={cat}
              className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
            >
              {cat}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400">
          {isUr ? "یہ کمپنیاں پہلے سے لوڈ ہوں گی — آپ بعد میں مزید شامل کر سکتے ہیں۔" : "Pre-loaded in your inventory. You can add more anytime."}
        </p>
      </div>
    </div>
  );
}

export type { NicheSettingsState };
