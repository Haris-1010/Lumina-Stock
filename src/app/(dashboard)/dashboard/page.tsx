import { DollarSign, ShoppingCart, ExternalLink, Globe, Package, PackageX, Users, TrendingUp, Sparkles, ArrowRight, HardHat } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TopProducts } from "@/components/dashboard/top-products";
import { getDashboardMetrics, getRecentActivity, getTopSellingProducts } from "@/lib/actions/dashboard";
import Link from "next/link";
import { getSalesSummary } from "@/lib/sales-summary";
import { getDashboardPeriod } from "@/lib/dashboard-period";
import { getServerLanguage, getServerTranslator } from "@/lib/i18n-server";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { requireOrganization } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNicheConfig } from "@/lib/niche-config";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period, start, end } = getDashboardPeriod((await searchParams).period);
  const [t, language] = await Promise.all([getServerTranslator(), getServerLanguage()]);

  let org;
  try {
    org = await requireOrganization();
  } catch {
    return <DashboardDemo t={t} language={language} />;
  }

  const [metrics, activities, topProducts, productCount, supplierCount] = await Promise.all([
    getDashboardMetrics(org.id),
    getRecentActivity(org.id),
    getTopSellingProducts(org.id),
    db.product.count({ where: { organizationId: org.id, deletedAt: null } }),
    db.supplier.count({ where: { organizationId: org.id, deletedAt: null } }),
  ]);

  const sales = await getSalesSummary(org.id, start, end);
  const labour = await db.labourPayment.aggregate({ where: { organizationId: org.id }, _sum: { totalAmount: true } }).catch(() => null);
  const salesTotal = sales.netSales;
  const periodLabel = language === "ur"
    ? { daily: "آج", weekly: "اس ہفتے (پیر سے)", monthly: "اس مہینے" }[period]
    : { daily: "Today", weekly: "This week (Monday onward)", monthly: "This month" }[period];

  const orgExt = org as typeof org & {
    websiteUrl?: string | null;
    subdomain?: string | null;
    niche?: string | null;
  };

  const storeUrl = orgExt.websiteUrl?.trim() ||
    (orgExt.subdomain ? `https://${orgExt.subdomain}.lumina-stock.app` : null);

  const showSetupBanner = productCount === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("dashboard.title")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("dashboard.subtitle")}</p>
        </div>

        {storeUrl ? (
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
          >
            <Globe className="h-4 w-4" />
            {language === "ur" ? "اسٹور دیکھیں" : "Visit Store"}
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
        ) : null}
      </div>

      {/* Setup banner — shown only when zero products */}
      {showSetupBanner && (
        <SetupChecklist
          hasProducts={productCount > 0}
          hasSuppliers={supplierCount > 0}
          nicheKey={orgExt.niche ?? "other"}
          language={language}
        />
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        <MetricCard title={t("dashboard.metric.totalInventoryValue")} value={formatCurrency(metrics.totalInventoryValue, org.currencyCode)} icon={DollarSign} color="emerald" trend={language === "ur" ? "موجودہ اسٹاک × قیمت خرید" : "Current stock × cost price"} />
        <MetricCard title={language === "ur" ? "کل لیبر ادائیگی" : "Total Labour Paid"} value={labour ? formatCurrency(labour._sum.totalAmount ?? 0, org.currencyCode) : (language === "ur" ? "دستیاب نہیں" : "Unavailable")} icon={HardHat} color="blue" trend={language === "ur" ? "تمام وقت کی ادائیگیاں" : "All-time recorded payments"} />
      </div>

      <section className="min-w-0 space-y-4" aria-labelledby="sales-summary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="sales-summary" className="text-lg font-semibold">{language === "ur" ? "فروخت کا خلاصہ" : "Sales overview"}</h2>
            <p className="text-sm text-zinc-500">{periodLabel} · {language === "ur" ? "پاکستان کا وقت (UTC+05:00)" : "Pakistan time (UTC+05:00)"}</p>
          </div>
          <nav aria-label="Sales period" className="flex flex-wrap gap-2">
            {(["daily", "weekly", "monthly"] as const).map((option) => (
              <Link key={option} href={`/dashboard?period=${option}`} scroll={false} aria-current={period === option ? "page" : undefined}
                className={`rounded-lg border px-4 py-2 text-sm font-medium ${period === option ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                {language === "ur" ? { daily: "روزانہ", weekly: "ہفتہ وار", monthly: "ماہانہ" }[option] : { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[option]}
              </Link>
            ))}
          </nav>
        </div>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          <MetricCard title={language === "ur" ? "خالص فروخت" : "Net Sales"} value={formatCurrency(salesTotal, org.currencyCode)} icon={DollarSign} color="emerald" trend={periodLabel} />
          <MetricCard title={language === "ur" ? "فروخت کے آرڈرز" : "Sales Orders"} value={formatNumber(sales.orders)} icon={ShoppingCart} color="blue" trend={periodLabel} />
          <MetricCard title={language === "ur" ? "خالص فروخت شدہ یونٹس" : "Net Units Sold"} value={formatNumber(sales.netUnits)} icon={Package} color="amber" trend={periodLabel} />
          <MetricCard title={language === "ur" ? "اوسط آرڈر کی قیمت" : "Average Order Value"} value={formatCurrency(sales.averageOrderValue, org.currencyCode)} icon={TrendingUp} color="emerald" trend={periodLabel} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title={language === "ur" ? "واپسی سے پہلے فروخت" : "Sales Before Returns"} value={formatCurrency(sales.grossSales, org.currencyCode)} icon={DollarSign} color="blue" trend={periodLabel} />
          <MetricCard title={language === "ur" ? "واپسی کی رقم" : "Customer Returns"} value={formatCurrency(sales.refunds, org.currencyCode)} icon={PackageX} color="amber" trend={`${sales.returnedUnits} ${language === "ur" ? "واپس شدہ یونٹس" : "units returned"}`} />
        </div>
        <p className="text-xs text-zinc-500">{language === "ur" ? "خالص فروخت = اس مدت کی فروخت − اس مدت میں ریکارڈ شدہ واپسی۔ اوسط آرڈر کی قیمت واپسی سے پہلے ہے۔" : "Net sales = sales in this period minus customer returns recorded in this period. Returns from earlier sales can make net sales negative. Average order value is before returns."}</p>
        {sales.unlinkedReturns > 0 && <p className="text-sm text-amber-700 dark:text-amber-400">{sales.unlinkedReturns} customer return(s) in this period need a receipt link before their value can be deducted. <Link className="underline" href="/returns">Review returns</Link></p>}

      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity activities={activities} />
        <TopProducts products={topProducts} currencyCode={org.currencyCode} />
      </div>
    </div>
  );
}

// ── Setup checklist (shown when org has no products yet) ──────────────────────

function SetupChecklist({
  hasProducts,
  hasSuppliers,
  nicheKey,
  language,
}: {
  hasProducts: boolean;
  hasSuppliers: boolean;
  nicheKey: string;
  language: "en" | "ur";
}) {
  const isUr = language === "ur";
  const config = getNicheConfig(nicheKey);

  const steps = [
    {
      done: hasProducts,
      icon: Package,
      title: isUr ? "پروڈکٹس شامل کریں" : "Add your products",
      desc: isUr
        ? `${config.displayName} کی فہرست تیار کریں — تیز، آسان`
        : `Build your ${config.displayName} product list — fast and easy`,
      href: "/inventory",
      cta: isUr ? "انوینٹری کھولیں" : "Open Inventory",
      color: "emerald",
    },
    {
      done: hasSuppliers,
      icon: Users,
      title: isUr ? "سپلائر شامل کریں" : "Add your suppliers",
      desc: isUr
        ? "سپلائرز کو پروڈکٹس سے لنک کریں تاکہ آٹو آرڈر ہو"
        : "Link suppliers to products for automatic purchase orders",
      href: "/suppliers",
      cta: isUr ? "سپلائرز کھولیں" : "Open Suppliers",
      color: "sky",
    },
    {
      done: false,
      icon: TrendingUp,
      title: isUr ? "ری آرڈر پوائنٹس ترتیب دیں" : "Set reorder points",
      desc: isUr
        ? "بتائیں کہ کتنے اسٹاک پر الرٹ آنا چاہیے"
        : "Tell the system when to alert you before stock runs out",
      href: "/inventory",
      cta: isUr ? "انوینٹری کھولیں" : "Go to Inventory",
      color: "amber",
    },
    {
      done: false,
      icon: Sparkles,
      title: isUr ? "پہلی AI پیشن گوئی چلائیں" : "Run your first AI forecast",
      desc: isUr
        ? "AI آپ کے اسٹاک آؤٹ کی پیشن گوئی کرے گا"
        : "AI will predict stockouts and suggest what to reorder",
      href: "/forecasts",
      cta: isUr ? "پیشن گوئی دیکھیں" : "View Forecasts",
      color: "violet",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex-wrap gap-3 border-b border-emerald-100/80 dark:border-emerald-800/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
            <Sparkles className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {isUr ? "شروع کرنے کے اقدامات" : "Getting started"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isUr
                ? `${completedCount} میں سے ${steps.length} مکمل`
                : `${completedCount} of ${steps.length} completed`}
            </p>
          </div>
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {Math.round((completedCount / steps.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Steps grid */}
      <div className="p-4 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <a
              key={step.title}
              href={step.href}
              className={`group flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                step.done
                  ? "border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-950/10 opacity-75"
                  : "border-white dark:border-zinc-700/60 bg-white dark:bg-zinc-900/60 hover:border-emerald-200 dark:hover:border-emerald-700/50"
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                step.done
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-zinc-100 dark:bg-zinc-800"
              }`}>
                {step.done
                  ? <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">✓</span>
                  : <Icon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${step.done ? "line-through text-zinc-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                  {step.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  {step.desc}
                </p>
                {!step.done && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                    {step.cta}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Demo (not logged in) ──────────────────────────────────────────────────────

function DashboardDemo({
  t,
  language,
}: {
  t: (key: Parameters<Awaited<ReturnType<typeof getServerTranslator>>>[0]) => string;
  language: "en" | "ur";
}) {

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("dashboard.title")}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("dashboard.subtitle")}</p>
      </div>

      <p className="text-sm text-zinc-500">{language === "ur" ? "اپنے اسٹور کا ڈیٹا دیکھنے کے لیے سائن ان کریں۔" : "Sign in to view your store’s dashboard data."}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity activities={[]} />
        <TopProducts products={[]} />
      </div>
    </div>
  );
}
