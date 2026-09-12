"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSmartColumnsForEntity } from "@/lib/column-config/defaults";
import type { ColumnConfig, EntityType, SmartColumnDef } from "@/lib/column-config/types";

const TYPE_COLORS: Record<string, string> = {
  text: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  number: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  currency: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  date: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  select: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  boolean: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  computed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

interface Props {
  entityType: EntityType;
  existingKeys: Set<string>;
  onSelect: (col: ColumnConfig) => void;
  onCreateCustom: () => void;
}

export function SmartColumnPicker({ entityType, existingKeys, onSelect, onCreateCustom }: Props) {
  const [search, setSearch] = useState("");

  const allColumns = useMemo(() => getSmartColumnsForEntity(entityType), [entityType]);

  const groups = useMemo(() => {
    const filtered = allColumns.filter(
      (col) =>
        !existingKeys.has(col.key) &&
        (!search.trim() ||
          col.label.toLowerCase().includes(search.toLowerCase()) ||
          col.description.toLowerCase().includes(search.toLowerCase()))
    );

    const grouped: Record<string, SmartColumnDef[]> = {};
    for (const col of filtered) {
      if (!grouped[col.group]) grouped[col.group] = [];
      grouped[col.group].push(col);
    }
    return grouped;
  }, [allColumns, existingKeys, search]);

  const totalAvailable = allColumns.filter((c) => !existingKeys.has(c.key)).length;

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 mb-3 bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Smart Columns ({totalAvailable} available)
        </span>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
        <Input
          placeholder="Search columns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-3">
        {Object.entries(groups).map(([group, cols]) => (
          <div key={group}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">{group}</p>
            <div className="flex flex-wrap gap-1.5">
              {cols.map((col) => (
                <button
                  key={col.key}
                  onClick={() =>
                    onSelect({
                      key: col.key,
                      visible: true,
                      order: 0,
                      width: 120,
                      label: col.label,
                      type: col.type,
                      options: col.options,
                      formula: col.formula,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-left group"
                  title={col.description}
                >
                  <Plus className="h-3 w-3 text-zinc-400 group-hover:text-blue-500 shrink-0" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{col.label}</span>
                  <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${TYPE_COLORS[col.type]}`}>
                    {col.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groups).length === 0 && (
          <p className="text-xs text-zinc-400 text-center py-4">
            {existingKeys.size > 0 ? "All smart columns are already added" : "No columns match your search"}
          </p>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <Button variant="outline" size="sm" onClick={onCreateCustom} className="gap-1.5 w-full">
          <Plus className="h-3.5 w-3.5" /> Create Custom Column
        </Button>
      </div>
    </div>
  );
}
