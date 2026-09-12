"use client";

import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCsvImport } from "@/hooks/use-csv-import";

/**
 * Upload control for the Settings → Data Import card. Posts a CSV file to the
 * existing /api/csv-upload endpoint (which enforces the csvImport permission and
 * plan limits server-side) and reports how many products were imported.
 */
export function CsvImportControl({ language }: { language: string }) {
  const isUr = language === "ur";
  const { handleCsv, busy, msg, fileRef } = useCsvImport({
    success: (count) =>
      isUr ? `${count} پروڈکٹ امپورٹ ہوگئے۔` : `Imported ${count} product(s).`,
    error: (fallback) =>
      isUr ? "امپورٹ ناکام۔ CSV فارمیٹ چیک کریں۔" : fallback,
  });

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsv}
      />
      <Button disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {isUr ? "CSV فائل اپ لوڈ کریں" : "Upload CSV File"}
      </Button>
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
