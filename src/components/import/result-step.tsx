"use client";

import { CheckCircle, XCircle, AlertTriangle, Download, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImportResult } from "@/lib/column-config/types";

interface ResultStepProps {
  result: ImportResult;
  entityType: "inventory" | "customers" | "suppliers";
  onReset: () => void;
}

export function ResultStep({ result, entityType, onReset }: ResultStepProps) {
  const hasErrors = result.errors.length > 0;
  const hasSuccess = result.created > 0 || result.updated > 0;

  function downloadErrorReport() {
    if (result.errors.length === 0) return;

    const rows = [
      ["Row", "Field", "Error", "Suggestion"],
      ...result.errors.flatMap((e) =>
        e.errors.map((err) => [
          String(e.rowIndex + 1),
          err.field,
          err.message,
          err.suggestion ?? "",
        ])
      ),
    ];

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${entityType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 py-4">
      {/* Status icon */}
      <div className="flex flex-col items-center gap-3">
        {hasErrors && !hasSuccess ? (
          <XCircle className="h-12 w-12 text-red-500" />
        ) : hasErrors ? (
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        ) : (
          <CheckCircle className="h-12 w-12 text-emerald-500" />
        )}

        <div className="text-center">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {hasErrors && !hasSuccess
              ? "Import Failed"
              : hasErrors
                ? "Import Completed with Errors"
                : "Import Successful!"}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {result.total} row(s) processed
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{result.total}</p>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide">Total</p>
        </div>
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{result.created}</p>
          <p className="text-[10px] text-emerald-500 uppercase tracking-wide">Created</p>
        </div>
        <div className="rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.updated}</p>
          <p className="text-[10px] text-blue-500 uppercase tracking-wide">Updated</p>
        </div>
        <div className="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/20 p-3 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{result.errors.length}</p>
          <p className="text-[10px] text-red-500 uppercase tracking-wide">Errors</p>
        </div>
      </div>

      {/* Error details */}
      {hasErrors && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 px-4 py-3">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-2">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {result.errors.length} row(s) failed
          </p>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {result.errors.slice(0, 10).map((e, i) => (
              <p key={i} className="text-[10px] text-red-600 dark:text-red-400">
                Row {e.rowIndex + 1}: {e.errors.map((err) => err.message).join("; ")}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-3">
        {hasErrors && (
          <Button variant="outline" size="sm" onClick={downloadErrorReport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download Error Report
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Import More
        </Button>
        <Button size="sm" onClick={() => window.location.reload()} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <ExternalLink className="h-3.5 w-3.5" /> View {entityType}
        </Button>
      </div>
    </div>
  );
}
