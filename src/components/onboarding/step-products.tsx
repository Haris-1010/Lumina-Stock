"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  Plus, Trash2, Upload, Sparkles, Table2, ClipboardList,
  CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, X, RefreshCw,
} from "lucide-react";
import { getNicheConfig } from "@/lib/niche-config";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  costPrice: string;
  sellingPrice: string;
  currentStock: string;
  expiresAt: string;
}

interface StepProductsProps {
  nicheKey: string;
  currency: string;
  language: string;
  onProductsChange: React.Dispatch<React.SetStateAction<ProductRow[]>>;
  products: ProductRow[];
}

type Tab = "quick" | "paste" | "csv" | "ai";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyRow(category = ""): ProductRow {
  return { id: makeId(), name: "", category, costPrice: "", sellingPrice: "", currentStock: "", expiresAt: "" };
}

/** Parse tab-separated or comma-separated pasted spreadsheet data */
function parsePastedData(raw: string, categories: string[]): ProductRow[] {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const separator = lines[0]!.includes("\t") ? "\t" : ",";
  const headerLine = lines[0]!.toLowerCase();
  const isHeaderRow = headerLine.includes("name") || headerLine.includes("price") || headerLine.includes("sku") || headerLine.includes("product");
  const dataLines = isHeaderRow ? lines.slice(1) : lines;

  // Try to detect column indices from header (if present)
  let nameIdx = 0, catIdx = 1, costIdx = 2, sellIdx = 3, stockIdx = 4;
  if (isHeaderRow) {
    const headers = lines[0]!.toLowerCase().split(separator).map((h) => h.trim().replace(/['"]/g, ""));
    nameIdx  = headers.findIndex((h) => h.includes("name") || h.includes("product")) ?? 0;
    catIdx   = headers.findIndex((h) => h.includes("company") || h.includes("manufacturer") || h.includes("cat") || h.includes("type")) ?? 1;
    costIdx  = headers.findIndex((h) => h.includes("cost") || h.includes("buy") || h.includes("purchase")) ?? 2;
    sellIdx  = headers.findIndex((h) => h.includes("sell") || h.includes("price") || h.includes("retail")) ?? 3;
    stockIdx = headers.findIndex((h) => h.includes("stock") || h.includes("qty") || h.includes("quantity")) ?? 4;
    if (nameIdx < 0) nameIdx = 0;
    if (costIdx < 0) costIdx = 2;
    if (sellIdx < 0) sellIdx = 3;
    if (stockIdx < 0) stockIdx = 4;
  }

  return dataLines
    .map((line) => {
      const cols = line.split(separator).map((c) => c.trim().replace(/^["']|["']$/g, ""));
      const name = cols[nameIdx]?.trim() ?? "";
      if (!name) return null;

      const detectedCat = cols[catIdx]?.trim() || categories[0] || "General";

      return {
        id: makeId(),
        name,
        category: detectedCat,
        costPrice: cols[costIdx]?.replace(/[^0-9.]/g, "") ?? "",
        sellingPrice: cols[sellIdx]?.replace(/[^0-9.]/g, "") ?? "",
        currentStock: cols[stockIdx]?.replace(/[^0-9]/g, "") ?? "",
        expiresAt: "",
      } satisfies ProductRow;
    })
    .filter((r): r is ProductRow => Boolean(r));
}

// ── Tab components ────────────────────────────────────────────────────────────

function QuickAddTab({
  products,
  onProductsChange,
  categories,
  trackExpiry,
  currency,
  isUr,
}: {
  products: ProductRow[];
  onProductsChange: (rows: ProductRow[]) => void;
  categories: string[];
  trackExpiry: boolean;
  currency: string;
  isUr: boolean;
}) {
  const rows = products.length > 0 ? products : [emptyRow(categories[0])];

  function updateRow(id: string, field: keyof ProductRow, value: string) {
    onProductsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    onProductsChange([...rows, emptyRow(categories[0])]);
  }

  function removeRow(id: string) {
    const next = rows.filter((r) => r.id !== id);
    onProductsChange(next.length ? next : [emptyRow(categories[0])]);
  }

  function handleKeyDown(e: React.KeyboardEvent, isLastRow: boolean) {
    if (e.key === "Enter" && isLastRow) {
      e.preventDefault();
      addRow();
    }
  }

  const colClass = "border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-2 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 dark:focus:border-emerald-600 outline-none w-full placeholder:text-zinc-400 dark:placeholder:text-zinc-500";

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {isUr
          ? "نام، قیمت اور اسٹاک لکھیں — SKU خودکار بنے گا۔ Enter دبائیں نئی قطار کے لیے۔"
          : "Type product name, prices and stock. SKU is auto-generated. Press Enter on the last row to add more."}
      </p>

      {/* Horizontally scrollable on mobile so the entry grid stays usable */}
      <div className="overflow-x-auto">
      <div className="min-w-[620px] space-y-1.5">
      {/* Table header */}
      <div className={cn(
        "grid gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1",
        trackExpiry ? "grid-cols-[2fr_1.2fr_0.9fr_0.9fr_0.8fr_0.9fr_auto]" : "grid-cols-[2fr_1.2fr_0.9fr_0.9fr_0.8fr_auto]"
      )}>
        <span>{isUr ? "پروڈکٹ کا نام" : "Product Name"}</span>
        <span>{isUr ? "کمپنی" : "Company"}</span>
        <span>{isUr ? `لاگت (${currency})` : `Cost (${currency})`}</span>
        <span>{isUr ? `قیمت (${currency})` : `Price (${currency})`}</span>
        <span>{isUr ? "اسٹاک" : "Stock"}</span>
        {trackExpiry && <span>{isUr ? "میعاد" : "Expiry"}</span>}
        <span />
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className={cn(
              "grid gap-1.5 items-center",
              trackExpiry ? "grid-cols-[2fr_1.2fr_0.9fr_0.9fr_0.8fr_0.9fr_auto]" : "grid-cols-[2fr_1.2fr_0.9fr_0.9fr_0.8fr_auto]"
            )}
          >
            <input
              value={row.name}
              onChange={(e) => updateRow(row.id, "name", e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, idx === rows.length - 1)}
              placeholder={isUr ? "مصنوع کا نام" : "Product name"}
              className={colClass}
              autoFocus={idx === rows.length - 1 && idx > 0}
            />
            <select
              value={row.category || categories[0]}
              onChange={(e) => updateRow(row.id, "category", e.target.value)}
              className={colClass}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={row.costPrice}
              onChange={(e) => updateRow(row.id, "costPrice", e.target.value)}
              placeholder="0"
              className={colClass}
            />
            <input
              type="number"
              min="0"
              value={row.sellingPrice}
              onChange={(e) => updateRow(row.id, "sellingPrice", e.target.value)}
              placeholder="0"
              className={colClass}
            />
            <input
              type="number"
              min="0"
              value={row.currentStock}
              onChange={(e) => updateRow(row.id, "currentStock", e.target.value)}
              placeholder="0"
              className={colClass}
            />
            {trackExpiry && (
              <input
                type="date"
                value={row.expiresAt}
                onChange={(e) => updateRow(row.id, "expiresAt", e.target.value)}
                className={colClass}
              />
            )}
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      </div>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 px-3 py-2 text-xs text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {isUr ? "نئی قطار شامل کریں" : "Add another row"}
      </button>

      <p className="text-[11px] text-zinc-400">
        {isUr
          ? `${rows.filter((r) => r.name.trim()).length} پروڈکٹ درج`
          : `${rows.filter((r) => r.name.trim()).length} product(s) entered`}
      </p>
    </div>
  );
}

function PasteTab({
  onProductsParsed,
  categories,
  isUr,
}: {
  onProductsParsed: (rows: ProductRow[]) => void;
  categories: string[];
  isUr: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ProductRow[]>([]);
  const [parsed, setParsed] = useState(false);

  function handleParse() {
    const rows = parsePastedData(raw, categories);
    setPreview(rows);
    setParsed(true);
    if (rows.length > 0) onProductsParsed(rows);
  }

  function handleClear() {
    setRaw("");
    setPreview([]);
    setParsed(false);
    onProductsParsed([]);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200/60 dark:border-sky-700/40 bg-sky-50/60 dark:bg-sky-950/20 p-3 text-xs text-sky-700 dark:text-sky-300 space-y-1">
        <p className="font-semibold">
          {isUr ? "اسپریڈشیٹ سے پیسٹ کریں" : "Paste directly from Excel or Google Sheets"}
        </p>
        <p className="text-sky-600/80 dark:text-sky-400/70">
          {isUr
            ? "اپنی فائل سے سیلز منتخب کریں، کاپی کریں، اور نیچے پیسٹ کریں۔ ہم کالمز خودکار پہچان لیتے ہیں۔"
            : "Select rows in your spreadsheet, copy (Ctrl+C), and paste below. Columns are auto-detected from headers like Name, Price, Company, Stock."}
        </p>
      </div>

      {!parsed ? (
        <div className="space-y-3">
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={isUr
              ? "یہاں پیسٹ کریں...\nمثال:\nنام\tکمپنی\tلاگت\tقیمت\tاسٹاک\nپیناڈول 500mg\tگولیاں\t50\t80\t200"
              : "Paste your spreadsheet data here...\nExample:\nName\tCompany\tCost\tPrice\tStock\nParacetamol 500mg\tTablets\t50\t80\t200"
            }
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none font-mono"
          />
          <button
            type="button"
            onClick={handleParse}
            disabled={!raw.trim()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40"
          >
            <Table2 className="h-4 w-4" />
            {isUr ? "پارس کریں اور پیش نظارہ کریں" : "Parse & Preview"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {preview.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  {isUr ? `${preview.length} پروڈکٹ پائے گئے` : `${preview.length} products detected`}
                </div>
                <button type="button" onClick={handleClear} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600">
                  <X className="h-3 w-3" /> {isUr ? "دوبارہ کریں" : "Start over"}
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      {["Name", "Company", "Cost", "Price", "Stock"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {preview.slice(0, 8).map((row) => (
                      <tr key={row.id} className="bg-white dark:bg-zinc-900/40">
                        <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 max-w-[160px] truncate">{row.name}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.category}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.costPrice || "—"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.sellingPrice || "—"}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.currentStock || "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 8 && (
                  <p className="px-3 py-2 text-[11px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-100 dark:border-zinc-800">
                    +{preview.length - 8} more
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <AlertCircle className="h-8 w-8 text-zinc-300" />
              <p className="text-sm text-zinc-500">
                {isUr ? "کوئی ڈیٹا نہیں ملا۔ فارمیٹ چیک کریں اور دوبارہ کوشش کریں۔" : "No data detected. Check your format and try again."}
              </p>
              <button type="button" onClick={handleClear} className="text-xs text-emerald-600 hover:underline">
                {isUr ? "دوبارہ کریں" : "Try again"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CsvTab({
  onProductsParsed,
  categories,
  isUr,
}: {
  onProductsParsed: (rows: ProductRow[]) => void;
  categories: string[];
  isUr: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const text = await file.text();

      // Use PapaParse for proper RFC 4180 CSV parsing (quoted fields,
      // embedded delimiters, etc.) instead of naive split-by-comma.
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: false,
        skipEmptyLines: true,
      });

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        setError(isUr ? "CSV فائل پڑھی نہیں جا سکی۔ فارمیٹ چیک کریں۔" : "Could not parse CSV file. Check the format.");
        return;
      }

      const rawLines = parsed.data.map((row) =>
        Object.values(row).map((v) => v ?? "").join("\t")
      );

      // Reuse the existing column-detection logic on the normalized rows
      const rows = parsePastedData(rawLines.join("\n"), categories);
      if (rows.length === 0) {
        setError(isUr ? "اس فائل میں کوئی پروڈکٹ نہیں ملا۔ فارمیٹ چیک کریں۔" : "No products found in that file. Check the format and try again.");
        return;
      }
      onProductsParsed(rows);
    } catch {
      setError(isUr ? "فائل پڑھی نہیں جا سکی۔ دوبارہ کوشش کریں۔" : "Could not read the file. Please try again.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFile}
      />
      <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/60 dark:bg-zinc-800/30 px-6 py-10 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950/40">
            <Upload className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div>
          <p className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
            {isUr ? "CSV فائل اپ لوڈ کریں" : "Upload a CSV file"}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {isUr
              ? "اپنی CSV فائل منتخب کریں — ہم پروڈکٹس خودکار پڑھ لیں گے۔ فارمیٹ دیکھنے کے لیے سیمپل ڈاؤن لوڈ کریں۔"
              : "Choose your CSV file — we'll read the products automatically. Download the sample template first to see the required format."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <a
            href="/api/csv-upload/sample"
            download
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {isUr ? "سیمپل ٹیمپلیٹ" : "Download Template"}
          </a>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Upload className="h-4 w-4" />
            {isUr ? "CSV فائل منتخب کریں" : "Choose CSV File"}
          </button>
        </div>
        {error && (
          <div className="flex items-center justify-center gap-2 text-xs text-red-600 dark:text-red-400 pt-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-400 text-center">
        {isUr
          ? "اپ لوڈ کے بعد پروڈکٹس Quick Add ٹیب میں نظر آئیں گے جہاں آپ انہیں ترمیم کر سکتے ہیں۔"
          : "After uploading, products appear in the Quick Add tab where you can review and edit them before saving."}
      </p>
    </div>
  );
}

function AiTab({
  nicheKey,
  currency,
  onProductsGenerated,
  isUr,
}: {
  nicheKey: string;
  currency: string;
  onProductsGenerated: (rows: ProductRow[]) => void;
  isUr: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<ProductRow[]>([]);
  const [error, setError] = useState("");
  const config = getNicheConfig(nicheKey);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/starter-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicheKey, currency }),
      });
      const data = (await res.json()) as {
        products?: Array<{ name: string; category: string; costPrice: number; sellingPrice: number; currentStock: number }>;
        error?: string;
      };

      if (data.error || !data.products) {
        setError(data.error ?? "Unexpected error. Please try again.");
        return;
      }

      const rows: ProductRow[] = data.products.map((p) => ({
        id: makeId(),
        name: p.name,
        category: p.category,
        costPrice: String(p.costPrice),
        sellingPrice: String(p.sellingPrice),
        currentStock: String(p.currentStock),
        expiresAt: "",
      }));

      setGenerated(rows);
      onProductsGenerated(rows);
    } catch {
      setError(isUr ? "کنکشن کی خرابی۔ دوبارہ کوشش کریں۔" : "Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {generated.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/40 shadow-lg">
            <Sparkles className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-center space-y-1.5 max-w-xs">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              {isUr ? "AI سے شروعاتی کیٹیلاگ بنائیں" : "Generate a starter catalog with AI"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isUr
                ? `آپ کی نوع (${config.displayName}) کے مطابق 12 حقیقی پروڈکٹ تجویز کیے جائیں گے۔ آپ انہیں تبدیل یا حذف کر سکتے ہیں۔`
                : `AI will suggest 12 realistic products for a ${config.displayName} business. Edit or remove any before importing.`}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400 max-w-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-6 py-3 font-semibold transition-all disabled:opacity-50 shadow-lg shadow-violet-200/50 dark:shadow-violet-900/30"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isUr ? "بن رہا ہے…" : "Generating…"}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {isUr ? "کیٹیلاگ بنائیں" : "Generate Catalog"}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {isUr ? `${generated.length} پروڈکٹ تیار` : `${generated.length} products generated`}
            </div>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {isUr ? "دوبارہ بنائیں" : "Regenerate"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  {["Product", "Company", `Cost (${currency})`, `Price (${currency})`, "Stock"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {generated.map((row) => (
                  <tr key={row.id} className="bg-white dark:bg-zinc-900/40">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 max-w-[160px]">{row.name}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{row.category}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{row.costPrice}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{row.sellingPrice}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{row.currentStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-400">
            {isUr
              ? "یہ صرف تجویز ہیں — آپ پچھلے ٹیب میں جا کر ترمیم کر سکتے ہیں۔"
              : "These are suggestions. Switch to the Quick Add tab to edit them before saving."}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StepProducts({ nicheKey, currency, language, onProductsChange, products }: StepProductsProps) {
  const isUr = language === "ur";
  const [activeTab, setActiveTab] = useState<Tab>("quick");
  const config = getNicheConfig(nicheKey);

  const handleAiGenerated = useCallback((rows: ProductRow[]) => {
    onProductsChange(rows);
    setActiveTab("quick");
  }, [onProductsChange]);

  const tabs: Array<{ key: Tab; label: string; labelUr: string; icon: React.ElementType }> = [
    { key: "quick",  label: "Quick Add",    labelUr: "فوری اضافہ",      icon: Plus },
    { key: "paste",  label: "Paste Sheet",  labelUr: "پیسٹ کریں",       icon: ClipboardList },
    { key: "csv",    label: "Import CSV",   labelUr: "CSV امپورٹ",       icon: Upload },
    { key: "ai",     label: "AI Generate",  labelUr: "AI کیٹیلاگ",      icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 p-1">
        {tabs.map(({ key, label, labelUr, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-all",
              activeTab === key
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{isUr ? labelUr : label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "quick" && (
          <QuickAddTab
            products={products}
            onProductsChange={onProductsChange}
            categories={config.categories}
            trackExpiry={config.trackExpiry}
            currency={currency}
            isUr={isUr}
          />
        )}
        {activeTab === "paste" && (
          <PasteTab
            onProductsParsed={(rows) => {
              // Merge with existing products so the user doesn't lose
              // Quick Add entries when switching tabs.
              onProductsChange((prev) => [...prev, ...rows]);
              setActiveTab("quick");
            }}
            categories={config.categories}
            isUr={isUr}
          />
        )}
        {activeTab === "csv" && (
          <CsvTab
            onProductsParsed={(rows) => {
              // Merge with existing products so the user doesn't lose
              // Quick Add entries when switching tabs.
              onProductsChange((prev) => [...prev, ...rows]);
              setActiveTab("quick");
            }}
            categories={config.categories}
            isUr={isUr}
          />
        )}
        {activeTab === "ai" && (
          <AiTab
            nicheKey={nicheKey}
            currency={currency}
            onProductsGenerated={handleAiGenerated}
            isUr={isUr}
          />
        )}
      </div>
    </div>
  );
}

