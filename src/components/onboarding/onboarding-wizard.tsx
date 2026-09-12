"use client";

import { useState, useTransition } from "react";
import {
  Sparkles, ArrowRight, ArrowLeft, Check,
  Cpu, Apple, Package, Pill, Shirt, ShoppingBag, Flower2,
  PenTool, Wrench, Car, Dumbbell, Monitor, Home, MoreHorizontal, Building2,
  LayoutGrid, LayoutList, Table2, CheckCircle2, Loader2,
  TrendingUp, Boxes, WifiOff,
} from "lucide-react";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { bulkCreateProducts } from "@/lib/actions/bulk-products";
import { Button } from "@/components/ui/button";
import { StepNicheSettings, type NicheSettingsState } from "@/components/onboarding/step-niche-settings";
import { StepProducts, type ProductRow } from "@/components/onboarding/step-products";
import { getNicheConfig } from "@/lib/niche-config";
import { cn } from "@/lib/utils";

// ─── Niches ──────────────────────────────────────────────────────────────────

const NICHES = [
  { key: "electronics",        icon: Cpu,            label: "Electronics",          labelUr: "الیکٹرونکس",        color: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-300" },
  { key: "fruits_vegetables",  icon: Apple,          label: "Fruits & Vegetables",  labelUr: "پھل و سبزیاں",      color: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-700 dark:text-green-300" },
  { key: "dry_fruits_nuts",    icon: Package,        label: "Dry Fruits & Nuts",    labelUr: "خشک میوہ جات",      color: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300" },
  { key: "medicine_pharmacy",  icon: Pill,           label: "Medicine & Pharmacy",  labelUr: "ادویات و فارمیسی",  color: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-700 dark:text-red-300" },
  { key: "clothing_apparel",   icon: Shirt,          label: "Clothing & Apparel",   labelUr: "کپڑے و لباس",      color: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-700 dark:text-purple-300" },
  { key: "shoes_footwear",     icon: ShoppingBag,    label: "Shoes & Footwear",     labelUr: "جوتے",             color: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-700 dark:text-orange-300" },
  { key: "groceries_food",     icon: ShoppingBag,    label: "Groceries & Food",     labelUr: "گروسری",           color: "bg-lime-50 border-lime-200 text-lime-700 dark:bg-lime-950/40 dark:border-lime-700 dark:text-lime-300" },
  { key: "cosmetics_beauty",   icon: Flower2,        label: "Cosmetics & Beauty",   labelUr: "کاسمیٹکس",         color: "bg-pink-50 border-pink-200 text-pink-700 dark:bg-pink-950/40 dark:border-pink-700 dark:text-pink-300" },
  { key: "stationery_office",  icon: PenTool,        label: "Stationery & Office",  labelUr: "اسٹیشنری",         color: "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/40 dark:border-sky-700 dark:text-sky-300" },
  { key: "hardware_tools",     icon: Wrench,         label: "Hardware & Tools",     labelUr: "ہارڈویئر",         color: "bg-zinc-100 border-zinc-300 text-zinc-700 dark:bg-zinc-800/60 dark:border-zinc-600 dark:text-zinc-300" },
  { key: "construction_materials", icon: Building2,  label: "Construction Materials", labelUr: "تعمیراتی سامان",  color: "bg-stone-100 border-stone-300 text-stone-700 dark:bg-stone-800/60 dark:border-stone-600 dark:text-stone-300" },
  { key: "automotive",         icon: Car,            label: "Automotive Parts",     labelUr: "آٹوموٹیو",         color: "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-950/40 dark:border-slate-600 dark:text-slate-300" },
  { key: "sports_fitness",     icon: Dumbbell,       label: "Sports & Fitness",     labelUr: "کھیل و صحت",       color: "bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/40 dark:border-teal-700 dark:text-teal-300" },
  { key: "software_digital",   icon: Monitor,        label: "Software & Digital",   labelUr: "ڈیجیٹل",           color: "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-300" },
  { key: "furniture_home",     icon: Home,           label: "Furniture & Home",     labelUr: "فرنیچر",           color: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950/40 dark:border-yellow-700 dark:text-yellow-300" },
  { key: "other",              icon: MoreHorizontal, label: "General / Mixed",      labelUr: "عمومی",             color: "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400" },
] as const;

// ─── Themes ──────────────────────────────────────────────────────────────────

const THEMES = [
  { key: "emerald",  label: "Emerald",  labelUr: "زمردی",    swatch: "bg-emerald-500",  ring: "ring-emerald-400",   desc: "Fresh green — default",        descUr: "تازہ سبز — ڈیفالٹ" },
  { key: "sky",      label: "Sky Blue", labelUr: "آسمانی",   swatch: "bg-sky-500",      ring: "ring-sky-400",       desc: "Clear & professional",         descUr: "واضح و پیشہ ورانہ" },
  { key: "violet",   label: "Violet",   labelUr: "بنفشہ",    swatch: "bg-violet-500",   ring: "ring-violet-400",    desc: "Bold & modern",                descUr: "جدید و جرأت مندانہ" },
  { key: "rose",     label: "Rose",     labelUr: "گلابی",    swatch: "bg-rose-500",     ring: "ring-rose-400",      desc: "Warm & inviting",              descUr: "گرم و دلکش" },
  { key: "amber",    label: "Amber",    labelUr: "عنبری",    swatch: "bg-amber-500",    ring: "ring-amber-400",     desc: "Energetic & vibrant",          descUr: "متحرک و جاندار" },
  { key: "zinc",     label: "Graphite", labelUr: "گرافائٹ",  swatch: "bg-zinc-600",     ring: "ring-zinc-500",      desc: "Minimal & focused",            descUr: "سادہ و مرکوز" },
] as const;

// ─── Layouts ─────────────────────────────────────────────────────────────────

const LAYOUTS = [
  { key: "card",  icon: LayoutGrid, label: "Card View",     labelUr: "کارڈ ویو",   desc: "Products as cards — great for image-heavy stock",       descUr: "مصنوعات بطور کارڈ",                                                          recommended: false },
  { key: "list",  icon: LayoutList, label: "Grouped List",  labelUr: "گروپ لسٹ",  desc: "Niche-grouped rows with quick actions — recommended",   descUr: "نوع کے مطابق گروپ — تجویز کردہ",                                            recommended: true  },
  { key: "table", icon: Table2,     label: "Compact Table", labelUr: "کمپیکٹ ٹیبل", desc: "Dense data view — best for large inventories",        descUr: "گھنا ڈیٹا ویو — بڑی انوینٹری کے لیے",                                     recommended: false },
] as const;

// ─── Feature highlights (shown on the welcome / first step) ──────────────────

const HIGHLIGHTS = [
  { icon: TrendingUp,  en: "AI stockout forecasts",  ur: "AI اسٹاک آؤٹ پیش گوئی" },
  { icon: Boxes,       en: "Dead-stock alerts",      ur: "مردہ اسٹاک الرٹس"      },
  { icon: ShoppingBag, en: "Fast cashier / POS",     ur: "تیز کیشئر / پی او ایس"  },
  { icon: WifiOff,     en: "Works offline",          ur: "آف لائن کام کرے"        },
] as const;

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = ["niche", "theme", "layout", "configure", "products"] as const;
type Step = typeof STEPS[number];

function makeDefaultNicheSettings(nicheKey: string): NicheSettingsState {
  const config = getNicheConfig(nicheKey);
  const features: Record<string, boolean> = {};
  for (const f of config.features) {
    features[f.key] = f.defaultOn;
  }
  return { features, taxRate: config.suggestedTaxRate };
}

interface Props {
  language: string;
  currency?: string;
}

export function OnboardingWizard({ language, currency = "PKR" }: Props) {
  const isUr = language === "ur";

  const [step, setStep]                     = useState<Step>("niche");
  const [selectedNiche, setSelectedNiche]   = useState<string>("");
  const [selectedTheme, setSelectedTheme]   = useState<string>("emerald");
  const [selectedLayout, setSelectedLayout] = useState<string>("list");
  const [nicheSettings, setNicheSettings]   = useState<NicheSettingsState>({ features: {}, taxRate: 0 });
  const [products, setProducts]             = useState<ProductRow[]>([]);
  const [importStatus, setImportStatus]     = useState<{ created: number; errors: string[] } | null>(null);
  const [isSaving, startSaving]             = useTransition();
  const [isImporting, setIsImporting]       = useState(false);

  const stepIndex  = STEPS.indexOf(step);
  const themeColor = THEMES.find((t) => t.key === selectedTheme)?.swatch ?? "bg-emerald-500";

  function goNext() {
    // When moving from niche step, pre-populate niche settings defaults
    if (step === "niche" && selectedNiche) {
      setNicheSettings(makeDefaultNicheSettings(selectedNiche));
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function handleFinish(skipProducts = false) {
    const validProducts = skipProducts
      ? []
      : products.filter((r) => r.name.trim());

    setIsImporting(validProducts.length > 0);

    // Bulk create products first (if any)
    let created = 0;
    const errors: string[] = [];
    if (validProducts.length > 0) {
      const result = await bulkCreateProducts(
        validProducts.map((r) => ({
          name: r.name,
          category: r.category,
          costPrice: parseFloat(r.costPrice) || 0,
          sellingPrice: parseFloat(r.sellingPrice) || 0,
          currentStock: parseInt(r.currentStock) || 0,
          expiresAt: r.expiresAt || null,
        }))
      );
      created = result.created;
      errors.push(...result.errors);
      setImportStatus({ created, errors });
    }

    setIsImporting(false);

    // Complete onboarding (redirects to dashboard)
    startSaving(async () => {
      await completeOnboarding({
        niche: selectedNiche,
        theme: selectedTheme,
        layout: selectedLayout,
      });
    });
  }

  const stepMeta: Record<Step, { title: string; titleUr: string; sub: string; subUr: string }> = {
    niche: {
      title:   "What type of business do you run?",
      titleUr: "آپ کا کاروبار کس نوع کا ہے؟",
      sub:     "We'll personalize your experience based on this",
      subUr:   "ہم آپ کا تجربہ ذاتی بنائیں گے",
    },
    theme: {
      title:   "Choose your colour theme",
      titleUr: "اپنی تھیم چنیں",
      sub:     "Pick the colour palette for your dashboard",
      subUr:   "آپ کے ڈیش بورڈ کا رنگ",
    },
    layout: {
      title:   "Choose your preferred layout",
      titleUr: "اپنا لے آؤٹ چنیں",
      sub:     "How would you like your inventory displayed?",
      subUr:   "انوینٹری کس طرح دکھائی دے؟",
    },
    configure: {
      title:   `Configure for ${getNicheConfig(selectedNiche || "other").displayName}`,
      titleUr: `${getNicheConfig(selectedNiche || "other").displayName} کی ترتیب`,
      sub:     "Enable the features that matter for your business",
      subUr:   "اپنے کاروبار کے لیے ضروری خصوصیات فعال کریں",
    },
    products: {
      title:   "Add your first products",
      titleUr: "اپنے پہلے پروڈکٹس شامل کریں",
      sub:     "Type them in, paste from Excel, import CSV, or let AI generate a starter list",
      subUr:   "لکھیں، اسپریڈشیٹ سے پیسٹ کریں، CSV امپورٹ کریں، یا AI سے فہرست بنائیں",
    },
  };

  const stepLabels: Record<Step, { en: string; ur: string }> = {
    niche:     { en: "Niche",     ur: "نوع"     },
    theme:     { en: "Theme",     ur: "تھیم"    },
    layout:    { en: "Layout",    ur: "لے آؤٹ"  },
    configure: { en: "Configure", ur: "ترتیب"   },
    products:  { en: "Products",  ur: "پروڈکٹس" },
  };

  const { title, titleUr, sub, subUr } = stepMeta[step];
  const validProductCount = products.filter((r) => r.name.trim()).length;

  return (
    <div className="min-h-screen [min-height:100dvh] bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-[#070b14] dark:via-[#090f1a] dark:to-[#070b14] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 mb-4 shadow-lg shadow-emerald-200/50">
            <Sparkles className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            {isUr ? "لومینا اسٹاک میں خوش آمدید" : "Welcome to Lumina Stock"}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
            {isUr
              ? "AI انوینٹری، تیز چیک آؤٹ اور آف لائن — ایک منٹ میں ترتیب دیں"
              : "AI inventory, fast checkout, offline-ready — set up in under a minute"}
          </p>

          {step === "niche" && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {HIGHLIGHTS.map(({ icon: Icon, en, ur }) => (
                <span
                  key={en}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {isUr ? ur : en}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1.5 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={cn(
                "h-1.5 w-full rounded-full transition-all duration-500",
                i < stepIndex
                  ? `${themeColor} opacity-100`
                  : i === stepIndex
                    ? `${themeColor}`
                    : "bg-zinc-200 dark:bg-zinc-700"
              )} />
              <span className={cn(
                "text-[9px] font-medium uppercase tracking-wide hidden sm:block",
                i === stepIndex ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400"
              )}>
                {isUr ? stepLabels[s].ur : stepLabels[s].en}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#0e1626] shadow-xl shadow-zinc-200/30 dark:shadow-black/40 overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isUr ? titleUr : title}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {isUr ? subUr : sub}
            </p>
          </div>

          <div className={cn("p-6", step === "products" ? "overflow-y-auto max-h-[520px]" : "")}>

            {/* Step 1: Niche */}
            {step === "niche" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {NICHES.map(({ key, icon: Icon, label, labelUr, color }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedNiche(key === selectedNiche ? "" : key)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]",
                      color,
                      selectedNiche === key
                        ? "border-current ring-2 ring-offset-1 ring-current shadow-md"
                        : "opacity-70 hover:opacity-100"
                    )}
                  >
                    {selectedNiche === key && (
                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-current/20">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-semibold leading-tight">{isUr ? labelUr : label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Theme */}
            {step === "theme" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEMES.map(({ key, label, labelUr, swatch, ring, desc, descUr }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTheme(key)}
                    className={cn(
                      "group flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all duration-150 hover:shadow-md",
                      selectedTheme === key
                        ? `border-zinc-400 dark:border-zinc-500 bg-zinc-50 dark:bg-zinc-800/60 shadow-md ring-2 ${ring} ring-offset-2`
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn("h-8 w-8 rounded-lg shadow-md", swatch)} />
                      {selectedTheme === key && (
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", swatch)}>
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{isUr ? labelUr : label}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{isUr ? descUr : desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Layout */}
            {step === "layout" && (
              <div className="space-y-3">
                {LAYOUTS.map(({ key, icon: Icon, label, labelUr, desc, descUr, recommended }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedLayout(key)}
                    className={cn(
                      "w-full flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all duration-150 hover:shadow-md",
                      selectedLayout === key
                        ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 shadow-md"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    )}
                  >
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      selectedLayout === key ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-zinc-100 dark:bg-zinc-800"
                    )}>
                      <Icon className={cn("h-6 w-6", selectedLayout === key ? "text-emerald-600" : "text-zinc-500")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{isUr ? labelUr : label}</span>
                        {recommended && (
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            {isUr ? "تجویز کردہ" : "RECOMMENDED"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{isUr ? descUr : desc}</p>
                    </div>
                    {selectedLayout === key && <Check className="h-5 w-5 text-emerald-600 shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* Step 4: Configure for Niche */}
            {step === "configure" && (
              <StepNicheSettings
                nicheKey={selectedNiche || "other"}
                language={language}
                value={nicheSettings}
                onChange={setNicheSettings}
              />
            )}

            {/* Step 5: Add Products */}
            {step === "products" && (
              <StepProducts
                nicheKey={selectedNiche || "other"}
                currency={currency}
                language={language}
                products={products}
                onProductsChange={setProducts}
              />
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 flex items-center justify-between gap-4">

            {/* Back */}
            {stepIndex > 0 ? (
              <Button variant="outline" onClick={goBack} disabled={isSaving || isImporting}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {isUr ? "پیچھے" : "Back"}
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              {/* Skip (not on first step) */}
              {stepIndex > 0 && step !== "products" && (
                <button
                  type="button"
                  onClick={goNext}
                  className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                  disabled={isSaving}
                >
                  {isUr ? "چھوڑیں" : "Skip"}
                </button>
              )}

              {/* Next / Finish */}
              {step !== "products" ? (
                <Button
                  onClick={goNext}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-6"
                  disabled={step === "niche" && !selectedNiche}
                >
                  {isUr ? "اگلا" : "Next"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {validProductCount === 0 && (
                    <button
                      type="button"
                      onClick={() => void handleFinish(true)}
                      disabled={isSaving || isImporting}
                      className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
                    >
                      {isUr ? "بعد میں شامل کریں" : "Add products later"}
                    </button>
                  )}
                  <Button
                    onClick={() => void handleFinish(false)}
                    disabled={isSaving || isImporting || validProductCount === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-6"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isUr ? "محفوظ ہو رہا ہے…" : "Saving…"}
                      </>
                    ) : isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isUr ? "شروع ہو رہا ہے…" : "Launching…"}
                      </>
                    ) : (
                      <>
                        {validProductCount > 0 ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            {isUr
                              ? `${validProductCount} پروڈکٹ محفوظ کریں اور شروع کریں`
                              : `Save ${validProductCount} product${validProductCount !== 1 ? "s" : ""} & Launch`}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            {isUr ? "ڈیش بورڈ شروع کریں" : "Launch Dashboard"}
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Import status (shown briefly before redirect) */}
        {importStatus && importStatus.created > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {isUr
              ? `${importStatus.created} پروڈکٹ کامیابی سے شامل ہوگئے`
              : `${importStatus.created} product${importStatus.created !== 1 ? "s" : ""} added successfully`}
          </div>
        )}

        {/* Skip entire onboarding */}
        <p className="text-center mt-5 text-xs text-zinc-400">
          <button
            type="button"
            onClick={() => void handleFinish(true)}
            disabled={isSaving || isImporting}
            className="underline underline-offset-2 hover:text-zinc-600"
          >
            {isUr ? "ابھی چھوڑیں اور بعد میں ترتیب دیں" : "Skip setup and go to dashboard"}
          </button>
        </p>

      </div>
    </div>
  );
}
