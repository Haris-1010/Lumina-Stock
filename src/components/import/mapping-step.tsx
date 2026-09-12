"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, Check, AlertTriangle, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { autoMapColumns, getTargetFields } from "@/lib/import/mapper";
import type { ColumnMapping, EntityType, ParsedRow } from "@/lib/column-config/types";

interface MappingStepProps {
  headers: string[];
  rows: ParsedRow[];
  entityType: EntityType;
  onBack: () => void;
  onMapped: (mappings: ColumnMapping[]) => void;
}

export function MappingStep({ headers, rows, entityType, onBack, onMapped }: MappingStepProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(() =>
    autoMapColumns(headers, entityType)
  );
  const [showPreview, setShowPreview] = useState(true);

  const targetFields = useMemo(() => getTargetFields(entityType), [entityType]);

  // Get unmapped source columns
  const mappedSourceCols = new Set(mappings.map((m) => m.sourceColumn));
  const unmappedHeaders = headers.filter((h) => !mappedSourceCols.has(h));

  // Get available target fields (not already mapped)
  const mappedTargetFields = new Set(mappings.map((m) => m.targetField));
  const allTargetFields = useMemo(() => {
    const flat: { key: string; label: string; group: string }[] = [];
    for (const field of targetFields) {
      if (field.key !== "actions") flat.push(field);
    }
    return flat;
  }, [targetFields]);

  function updateMapping(sourceColumn: string, targetField: string) {
    setMappings((prev) => {
      const existing = prev.find((m) => m.sourceColumn === sourceColumn);
      if (existing) {
        return prev.map((m) =>
          m.sourceColumn === sourceColumn
            ? { ...m, targetField, isCustom: targetField.startsWith("custom:") }
            : m
        );
      }
      return [...prev, {
        sourceColumn,
        targetField,
        isCustom: targetField.startsWith("custom:"),
      }];
    });
  }

  function removeMapping(sourceColumn: string) {
    setMappings((prev) => prev.filter((m) => m.sourceColumn !== sourceColumn));
  }

  function addUnmappedColumn(sourceColumn: string) {
    setMappings((prev) => [
      ...prev,
      { sourceColumn, targetField: "", isCustom: false },
    ]);
  }

  // Preview first 5 rows
  const previewRows = rows.slice(0, 5).map((row) => {
    const mapped: Record<string, string> = {};
    for (const m of mappings) {
      if (m.targetField) {
        mapped[m.targetField] = row.raw[m.sourceColumn] ?? "";
      }
    }
    return mapped;
  });

  const mappedCount = mappings.filter((m) => m.targetField).length;
  const unmappedCount = headers.length - mappedCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Map Columns</h3>
            <p className="text-xs text-zinc-500">
              {headers.length} columns detected · {mappedCount} mapped · {unmappedCount} unmapped
            </p>
          </div>
        </div>
        <Button onClick={() => onMapped(mappings.filter((m) => m.targetField))} size="sm">
          Review Data →
        </Button>
      </div>

      {/* Unmapped columns warning */}
      {unmappedHeaders.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30 px-3 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {unmappedHeaders.length} column(s) will be ignored:{" "}
            {unmappedHeaders.slice(0, 5).map((h) => (
              <Badge key={h} variant="secondary" className="text-[10px] mx-0.5">{h}</Badge>
            ))}
            {unmappedHeaders.length > 5 && <span>+{unmappedHeaders.length - 5} more</span>}
          </p>
        </div>
      )}

      {/* Mapping table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="grid grid-cols-[1fr_40px_1fr] items-center px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Source Column (from file)
          </span>
          <span />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Target Field
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[300px] overflow-y-auto">
          {headers.map((header) => {
            const mapping = mappings.find((m) => m.sourceColumn === header);
            const isMapped = !!mapping?.targetField;

            // Sample values from first 3 rows
            const samples = rows
              .slice(0, 3)
              .map((r) => r.raw[header])
              .filter(Boolean);

            return (
              <div
                key={header}
                className={`grid grid-cols-[1fr_40px_1fr] items-center px-4 py-2.5 gap-2 ${
                  isMapped ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-800/30"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {header}
                  </p>
                  {samples.length > 0 && (
                    <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                      {samples.map((s, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-1">·</span>}
                          {s}
                        </span>
                      ))}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  {isMapped ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-zinc-200 dark:border-zinc-700" />
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Select
                    value={mapping?.targetField ?? ""}
                    onValueChange={(v) => {
                      if (v === "__skip") {
                        removeMapping(header);
                      } else {
                        updateMapping(header, v);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip" className="text-xs text-zinc-400">
                        — Skip (don&apos;t import) —
                      </SelectItem>
                      {allTargetFields.map((field) => (
                        <SelectItem
                          key={field.key}
                          value={field.key}
                          disabled={mappedTargetFields.has(field.key) && mapping?.targetField !== field.key}
                          className="text-xs"
                        >
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Preview ({Math.min(5, rows.length)} of {rows.length} rows)
          </button>

          {showPreview && (
            <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                    {mappings.filter((m) => m.targetField).map((m) => (
                      <th key={m.targetField} className="px-3 py-1.5 text-left font-medium text-zinc-500 uppercase text-[10px]">
                        {allTargetFields.find((f) => f.key === m.targetField)?.label ?? m.targetField}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      {mappings.filter((m) => m.targetField).map((m) => (
                        <td key={m.targetField} className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                          {row[m.targetField!] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
