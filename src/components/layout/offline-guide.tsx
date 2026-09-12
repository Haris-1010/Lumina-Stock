import { Wifi, WifiOff, Download, RefreshCw, Smartphone } from "lucide-react";

interface OfflineGuideProps {
  language: "en" | "ur";
}

export function OfflineGuide({ language }: OfflineGuideProps) {
  const isUr = language === "ur";

  const content = isUr
    ? {
        title: "آف لائن استعمال",
        subtitle: "Lumina Stock کو انٹرنیٹ کے بغیر بھی استعمال کریں",
        steps: [
          {
            icon: "download",
            heading: "ایپ انسٹال کریں (PWA)",
            body: 'Chrome/Edge میں اوپر ایڈریس بار کے قریب "Install" آئیکون پر کلک کریں، یا براؤزر مینو سے "Add to Home Screen" منتخب کریں۔ Safari (iPhone) میں Share بٹن دبا کر "Add to Home Screen" کریں۔',
          },
          {
            icon: "wifi",
            heading: "پہلی بار آن لائن کھولیں",
            body: "سروس ورکر آپ کے صفحات اور ڈیٹا کو کیش کر لے گا۔ ایک بار ڈیش بورڈ، انوینٹری، کیشیئر اور فورکاسٹ صفحات ضرور کھولیں تاکہ وہ آف لائن محفوظ ہو جائیں۔",
          },
          {
            icon: "offline",
            heading: "آف لائن کیا کام کرتا ہے؟",
            body: "کیشیئر سیلز، پرچیز آرڈر بنانا، انوینٹری دیکھنا، فورکاسٹ ٹیبل، اور ڈیش بورڈ سب آف لائن چلتے ہیں۔ آف لائن بنائے گئے سیلز اور POs queue میں محفوظ ہوتے ہیں اور آن لائن آنے پر خودکار sync ہو جاتے ہیں۔",
          },
          {
            icon: "refresh",
            heading: "واپس آن لائن آنے پر",
            body: "اوپر ایک بینر آئے گا جس میں pending ریکارڈز کی تعداد دکھے گی۔ \"Sync now\" دبائیں یا انتظار کریں — قطار میں موجود سیلز اور POs خودکار اپلوڈ ہو جائیں گے اور صفحہ تازہ ڈیٹا کے ساتھ reload ہو گا۔",
          },
        ],
        note: "AI معاون کے لیے انٹرنیٹ ضروری ہے۔ باقی تمام بنیادی فیچرز — کیشیئر، پرچیز آرڈرز، انوینٹری — آف لائن مکمل کام کرتے ہیں۔ آن لائن آنے پر sync بینر خودکار ظاہر ہوتا ہے۔",
      }
    : {
        title: "Offline Usage",
        subtitle: "Use Lumina Stock even without an internet connection",
        steps: [
          {
            icon: "download",
            heading: "Install as an App (PWA)",
            body: 'In Chrome or Edge, click the Install icon in the address bar or choose "Add to Home Screen" from the browser menu. On iPhone Safari, tap the Share button then "Add to Home Screen".',
          },
          {
            icon: "wifi",
            heading: "Open pages while online first",
            body: "The service worker caches pages after your first visit. Open Dashboard, Inventory, Cashier, and Forecasts at least once while online — they will then be available offline automatically.",
          },
          {
            icon: "offline",
            heading: "What works offline?",
            body: "Cashier sales, purchase order creation, inventory viewing, Forecast table, and Dashboard all work offline. Sales and POs created offline are queued and sync automatically when you reconnect.",
          },
          {
            icon: "refresh",
            heading: "When you come back online",
            body: "A banner appears at the top showing how many records are pending. Tap \"Sync now\" or wait — queued sales and POs upload automatically and the page reloads with fresh data.",
          },
        ],
        note: "The AI Assistant requires an internet connection. All other core features — Cashier, Purchase Orders, Inventory — work fully offline. A sync banner appears automatically when you reconnect.",
      };

  function StepIcon({ type }: { type: string }) {
    const cls = "h-4 w-4";
    if (type === "download") return <Download className={cls} />;
    if (type === "wifi") return <Wifi className={cls} />;
    if (type === "offline") return <WifiOff className={cls} />;
    if (type === "refresh") return <RefreshCw className={cls} />;
    return <Smartphone className={cls} />;
  }

  return (
    <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
        <WifiOff className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {content.title}
        </span>
      </div>

      <div className="p-5 space-y-5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{content.subtitle}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {content.steps.map((step, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 p-3.5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                <StepIcon type={step.icon} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-0.5">
                  {step.heading}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 px-3.5 py-3">
          <Wifi className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            {content.note}
          </p>
        </div>
      </div>
    </div>
  );
}
