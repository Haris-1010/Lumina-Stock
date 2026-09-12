"use client";

import { Upload, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCsvImport } from "@/hooks/use-csv-import";

/** CSV import and sample download for inventory setup. */
export function InventoryImportControls() {
  const { handleCsv, busy, msg: csvMsg, fileRef } = useCsvImport({
    success: (count) => `Imported ${count} product(s).`,
    error: (fallback) => fallback,
  });
  const displayMsg = csvMsg;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsv}
      />
      <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        Import CSV
      </Button>
      <Button variant="outline" asChild>
        <a href="/api/csv-upload/sample" download>
          <FileDown className="mr-2 h-4 w-4" />
          Sample CSV
        </a>
      </Button>
      {displayMsg && (
        <span className={`text-xs ${displayMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {displayMsg.text}
        </span>
      )}
    </div>
  );
}
