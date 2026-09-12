"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/providers/i18n-provider";

interface WebImportApiResponse {
  success?: boolean;
  error?: string;
  cleanedNoiseRecords?: number;
  imported?: number;
  created?: number;
  updated?: number;
  visitedPages?: number;
  scrapedProducts?: number;
  warnings?: string[];
  sample?: Array<{
    sku: string;
    name: string;
    category: string;
    stock: number;
    price: number;
  }>;
}

export function WebImporter() {
  const { language } = useI18n();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("12");
  const [maxProducts, setMaxProducts] = useState("700");
  const [defaultCategory, setDefaultCategory] = useState("Uncategorized");
  const [defaultStock, setDefaultStock] = useState("10");
  const [costPriceFactor, setCostPriceFactor] = useState("0.65");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<WebImportApiResponse | null>(null);

  const labels = useMemo(
    () =>
      language === "ur"
        ? {
            helper:
              "ویب سائٹ URL دے کر مصنوعات کا ڈیٹا خودکار طور پر اسکریپ کریں اور DB میں محفوظ کریں۔",
            url: "ویب سائٹ URL",
            urlPlaceholder: "https://example.com/products",
            maxPages: "زیادہ سے زیادہ صفحات",
            maxProducts: "زیادہ سے زیادہ مصنوعات",
            category: "ڈیفالٹ کمپنی",
            stock: "ڈیفالٹ اسٹاک",
            costFactor: "کاسٹ فیکٹر (0-1)",
            importButton: "ویب سائٹ سے امپورٹ کریں",
            importing: "امپورٹ ہو رہا ہے...",
            resultTitle: "امپورٹ مکمل",
            cleaned: "صاف کی گئی فالتو قطاریں",
            imported: "کل امپورٹ",
            created: "نئی مصنوعات",
            updated: "اپ ڈیٹ شدہ",
            visited: "وزٹ شدہ صفحات",
            discovered: "اسکریپ شدہ مصنوعات",
            warnings: "وارننگز",
            sample: "نمونہ ریکارڈز",
          }
        : {
            helper:
              "Provide a website URL and automatically scrape product records into your database.",
            url: "Website URL",
            urlPlaceholder: "https://example.com/products",
            maxPages: "Max Pages",
            maxProducts: "Max Products",
            category: "Default Company",
            stock: "Default Stock",
            costFactor: "Cost Factor (0-1)",
            importButton: "Import From Website",
            importing: "Importing...",
            resultTitle: "Import Completed",
            cleaned: "Cleaned Noise Rows",
            imported: "Imported",
            created: "Created",
            updated: "Updated",
            visited: "Visited Pages",
            discovered: "Scraped Products",
            warnings: "Warnings",
            sample: "Sample Records",
          },
    [language]
  );

  async function handleImport() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/web-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: trimmedUrl,
          maxPages: Number.parseInt(maxPages, 10),
          maxProducts: Number.parseInt(maxProducts, 10),
          defaultCategory: defaultCategory.trim() || "Uncategorized",
          defaultStock: Number.parseInt(defaultStock, 10),
          costPriceFactor: Number.parseFloat(costPriceFactor),
        }),
      });

      const payload = (await response.json()) as WebImportApiResponse;

      if (!response.ok || !payload.success) {
        setError(payload.error || "Website import failed.");
        setResult(payload);
        return;
      }

      setResult(payload);
    } catch {
      setError(
        language === "ur"
          ? "نیٹ ورک مسئلہ پیش آیا۔ دوبارہ کوشش کریں۔"
          : "A network error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">{labels.helper}</p>

      <div className="space-y-2">
        <Label htmlFor="web-import-url">{labels.url}</Label>
        <Input
          id="web-import-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={labels.urlPlaceholder}
          type="url"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="web-import-max-pages">{labels.maxPages}</Label>
          <Input
            id="web-import-max-pages"
            type="number"
            min={1}
            max={40}
            value={maxPages}
            onChange={(event) => setMaxPages(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="web-import-max-products">{labels.maxProducts}</Label>
          <Input
            id="web-import-max-products"
            type="number"
            min={1}
            max={3000}
            value={maxProducts}
            onChange={(event) => setMaxProducts(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="web-import-category">{labels.category}</Label>
          <Input
            id="web-import-category"
            value={defaultCategory}
            onChange={(event) => setDefaultCategory(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="web-import-stock">{labels.stock}</Label>
          <Input
            id="web-import-stock"
            type="number"
            min={0}
            max={1000000}
            value={defaultStock}
            onChange={(event) => setDefaultStock(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="web-import-cost-factor">{labels.costFactor}</Label>
          <Input
            id="web-import-cost-factor"
            type="number"
            min={0.01}
            max={1}
            step={0.01}
            value={costPriceFactor}
            onChange={(event) => setCostPriceFactor(event.target.value)}
          />
        </div>
      </div>

      <Button onClick={() => void handleImport()} disabled={loading || !url.trim()}>
        {loading ? labels.importing : labels.importButton}
      </Button>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {result?.success && (
        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-semibold">{labels.resultTitle}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <p>{labels.imported}: {result.imported ?? 0}</p>
            <p>{labels.created}: {result.created ?? 0}</p>
            <p>{labels.updated}: {result.updated ?? 0}</p>
            <p>{labels.cleaned}: {result.cleanedNoiseRecords ?? 0}</p>
            <p>{labels.visited}: {result.visitedPages ?? 0}</p>
            <p>{labels.discovered}: {result.scrapedProducts ?? 0}</p>
          </div>

          {Array.isArray(result.warnings) && result.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium">{labels.warnings}</p>
              <div className="max-h-32 overflow-auto rounded border border-emerald-200 bg-white p-2 text-xs text-zinc-700">
                {result.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`}>- {warning}</p>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.sample) && result.sample.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium">{labels.sample}</p>
              <div className="max-h-40 overflow-auto rounded border border-emerald-200 bg-white p-2 text-xs text-zinc-700">
                {result.sample.map((item) => (
                  <p key={`${item.sku}-${item.name}`}>
                    {item.sku} | {item.name} | {item.category} | stock:{" "}
                    {item.stock} | price: {item.price}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
