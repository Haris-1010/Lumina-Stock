"use client";

import { useState } from "react";
import { ArrowLeft, Check, X, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ValidatedRow, ImportError, ColumnMapping, EntityType } from "@/lib/column-config/types";

interface ReviewStepProps {
  rows: ValidatedRow[];
  mappings: ColumnMapping[];
  entityType: EntityType;
  onBack: () => void;
  onImport: (rows: ValidatedRow[]) => void;
  isImporting: boolean;
}

export function ReviewStep({ rows, mappings, entityType, onBack, onImport, isImporting }: ReviewStepProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(
    new Set(rows.filter((r) => r.errors.length === 0).map((r) => r.rowIndex))
  );

  const activeMappings = mappings.filter((m) => m.targetField);
  const totalErrors = rows.filter((r) => r.errors.length > 0).length;
  const totalDuplicates = rows.filter((r) => r.isDuplicate).length;
  const totalCreates = rows.filter((r) => r.action === "create" && r.errors.length === 0).length;
  const totalUpdates = rows.filter((r) => r.action === "update" && r.errors.length === 0).length;

  function toggleRow(idx: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    const validRows = rows.filter((r) => r.errors.length === 0).map((r) => r.rowIndex);
    if (validRows.every((idx) => selectedRows.has(idx))) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(validRows));
    }
  }

  function handleImport() {
    const selected = rows.filter((r) => selectedRows.has(r.rowIndex));
    onImport(selected);
  }

  const allValidSelected = rows.filter((r) => r.errors.length === 0).every((r) => selectedRows.has(r.rowIndex));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Review & Import</h3>
            <p className="text-xs text-zinc-500">
              {rows.length} rows · {selectedRows.size} selected
            </p>
          </div>
        </div>
        <Button onClick={handleImport} disabled={isImporting || selectedRows.size === 0} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
          {isImporting ? "Importing..." : `Import ${selectedRows.size} Rows`}
        </Button>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {totalCreates > 0 && (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
            {totalCreates} new
          </Badge>
        )}
        {totalDuplicates > 0 && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px]">
            {totalDuplicates} update
          </Badge>
        )}
        {totalErrors > 0 && (
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-[10px]">
            {totalErrors} error
          </Badge>
        )}
      </div>

      {/* Error rows */}
      {totalErrors > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 px-3 py-2">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {totalErrors} row(s) have validation errors and will be skipped
          </p>
          <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
            {rows.filter((r) => r.errors.length > 0).slice(0, 8).map((r) => (
              <p key={r.rowIndex} className="text-[10px] text-red-600 dark:text-red-400">
                Row {r.rowIndex + 1}: {r.errors.map((e) => e.message).join(", ")}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={allValidSelected}
                    onChange={toggleAll}
                    className="rounded border-zinc-300"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500 uppercase text-[10px]">Row</th>
                {activeMappings.map((m) => (
                  <th key={m.targetField} className="px-3 py-2 text-left font-medium text-zinc-500 uppercase text-[10px]">
                    {m.targetField}
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium text-zinc-500 uppercase text-[10px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((row) => {
                const hasError = row.errors.length > 0;
                const isSelected = selectedRows.has(row.rowIndex);

                return (
                  <tr
                    key={row.rowIndex}
                    className={`${hasError ? "bg-red-50 dark:bg-red-950/20" : isSelected ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""} hover:bg-zinc-50 dark:hover:bg-zinc-800/30`}
                  >
                    <td className="px-3 py-2">
                      {!hasError && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.rowIndex)}
                          className="rounded border-zinc-300"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-400 font-mono">{row.rowIndex + 1}</td>
                    {activeMappings.map((m) => (
                      <td key={m.targetField} className="px-3 py-2 text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">
                        {String(row.mapped[m.targetField!] ?? "—")}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {hasError ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 text-[9px]">
                          {row.errors[0]?.message}
                        </Badge>
                      ) : row.isDuplicate ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[9px]">
                          Update
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[9px]">
                          New
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
