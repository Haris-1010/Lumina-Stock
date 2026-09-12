"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ColumnConfig, ColumnType, EntityType } from "@/lib/column-config/types";

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown Select" },
  { value: "boolean", label: "Yes / No Toggle" },
];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

interface Props {
  entityType: EntityType;
  onAdd: (col: ColumnConfig) => void;
  onCancel: () => void;
}

export function CustomColumnForm({ entityType, onAdd, onCancel }: Props) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [optionsStr, setOptionsStr] = useState("");
  const [required, setRequired] = useState(false);
  const [error, setError] = useState("");

  const key = `custom:${slugify(label)}`;
  const options = type === "select"
    ? optionsStr.split(",").map((o) => o.trim()).filter(Boolean)
    : undefined;

  const handleAdd = () => {
    if (!label.trim()) {
      setError("Column label is required.");
      return;
    }
    if (type === "select" && (!options || options.length === 0)) {
      setError("At least one option is required for dropdown columns.");
      return;
    }

    onAdd({
      key,
      visible: true,
      order: 0,
      width: 120,
      label: label.trim(),
      type,
      options,
      required,
    });
  };

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-3 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Create Custom Column</span>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2 mb-3">{error}</p>
      )}

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Column Label *</Label>
          <Input
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(""); }}
            placeholder="e.g. Brand, Warranty, Location"
            className="mt-1 h-8 text-sm"
            autoFocus
          />
          {label.trim() && (
            <p className="text-[11px] text-zinc-400 mt-1">Key: <span className="font-mono">{key}</span></p>
          )}
        </div>

        <div>
          <Label className="text-xs">Data Type *</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {COLUMN_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setType(ct.value)}
                className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                  type === ct.value
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {type === "select" && (
          <div>
            <Label className="text-xs">Options (comma-separated) *</Label>
            <Input
              value={optionsStr}
              onChange={(e) => { setOptionsStr(e.target.value); setError(""); }}
              placeholder="Active, Discontinued, Seasonal"
              className="mt-1 h-8 text-sm"
            />
            {options && options.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {options.map((opt) => (
                  <Badge key={opt} variant="secondary" className="text-[10px]">{opt}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="custom-col-required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded border-zinc-300"
          />
          <Label htmlFor="custom-col-required" className="text-xs cursor-pointer">Required field</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={handleAdd}>Add Column</Button>
        </div>
      </div>
    </div>
  );
}
