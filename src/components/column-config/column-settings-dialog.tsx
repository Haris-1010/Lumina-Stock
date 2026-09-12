"use client";

import { useState, useTransition, useCallback } from "react";
import { Settings, GripVertical, Eye, EyeOff, Trash2, Plus, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type ColumnConfig,
  type EntityColumnConfig,
  type OrgColumnConfigs,
  type EntityType,
} from "@/lib/column-config/types";
import {
  DEFAULT_COLUMNS,
  BUILTIN_COLUMN_LABELS,
} from "@/lib/column-config/defaults";
import {
  resolveColumnConfig,
  getVisibleColumns,
} from "@/lib/column-config/resolver";
import { saveColumnConfigsForCurrentOrganization, resetColumnConfigsForCurrentOrganization } from "@/lib/actions/column-config";
import { SmartColumnPicker } from "./smart-column-picker";
import { CustomColumnForm } from "./custom-column-form";

interface Props {
  initialConfigs: OrgColumnConfigs;
}

const TYPE_COLORS: Record<string, string> = {
  text: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  number: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  currency: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  date: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  select: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  boolean: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  computed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const ENTITY_TABS: { value: EntityType; label: string }[] = [
  { value: "inventory", label: "Inventory" },
  { value: "customers", label: "Customers" },
  { value: "suppliers", label: "Suppliers" },
];

export function ColumnSettingsDialog({ initialConfigs }: Props) {
  const [open, setOpen] = useState(false);
  const [configs, setConfigs] = useState<OrgColumnConfigs>(initialConfigs);
  const [activeTab, setActiveTab] = useState<EntityType>("inventory");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentEntityConfig = resolveColumnConfig(activeTab, configs);
  const visibleColumns = getVisibleColumns(currentEntityConfig);
  const builtinLabels = BUILTIN_COLUMN_LABELS[activeTab] ?? {};
  const builtinKeys = DEFAULT_COLUMNS[activeTab]?.columns.map(c => c.key) ?? [];

  const updateColumn = useCallback((key: string, updates: Partial<ColumnConfig>) => {
    setConfigs((prev) => {
      const entityConfig = resolveColumnConfig(activeTab, prev);
      const newColumns = entityConfig.columns.map((col) =>
        col.key === key ? { ...col, ...updates } : col
      );
      return { ...prev, [activeTab]: { columns: newColumns } };
    });
  }, [activeTab]);

  const moveColumn = useCallback((key: string, direction: "up" | "down") => {
    setConfigs((prev) => {
      const entityConfig = resolveColumnConfig(activeTab, prev);
      const cols = [...entityConfig.columns].sort((a, b) => a.order - b.order);
      const idx = cols.findIndex((c) => c.key === key);
      if (idx === -1) return prev;

      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= cols.length) return prev;

      // Swap order values
      const tmpOrder = cols[idx].order;
      cols[idx] = { ...cols[idx], order: cols[targetIdx].order };
      cols[targetIdx] = { ...cols[targetIdx], order: tmpOrder };

      return { ...prev, [activeTab]: { columns: cols } };
    });
  }, [activeTab]);

  const removeColumn = useCallback((key: string) => {
    setConfigs((prev) => {
      const entityConfig = resolveColumnConfig(activeTab, prev);
      const newColumns = entityConfig.columns.filter((col) => col.key !== key);
      return { ...prev, [activeTab]: { columns: newColumns } };
    });
  }, [activeTab]);

  const addColumn = useCallback((col: ColumnConfig) => {
    setConfigs((prev) => {
      const entityConfig = resolveColumnConfig(activeTab, prev);
      const maxOrder = Math.max(0, ...entityConfig.columns.map((c) => c.order));
      return {
        ...prev,
        [activeTab]: {
          columns: [...entityConfig.columns, { ...col, order: maxOrder + 1, visible: true }],
        },
      };
    });
    setShowAddColumn(false);
    setShowCustomForm(false);
  }, [activeTab]);

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveColumnConfigsForCurrentOrganization(configs);
      if (result.success) {
        setOpen(false);
      }
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetColumnConfigsForCurrentOrganization(activeTab);
      if (result.success) {
        setConfigs((prev) => {
          const updated = { ...prev };
          delete updated[activeTab];
          return updated;
        });
      }
    });
  };

  const sortedColumns = [...currentEntityConfig.columns].sort((a, b) => a.order - b.order);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setConfigs(initialConfigs); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 px-3 font-semibold text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600" title="Configure visible columns">
          <Settings className="h-4 w-4" />
          Columns
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Columns</DialogTitle>
          <DialogDescription>
            Add, remove, reorder, or hide columns. Custom data is preserved even when columns are hidden.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EntityType)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            {ENTITY_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          {ENTITY_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="flex-1 overflow-hidden flex flex-col mt-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-zinc-500">
                  {sortedColumns.filter(c => c.visible).length} visible of {sortedColumns.length} columns
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddColumn(!showAddColumn)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Column
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-zinc-500">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                </div>
              </div>

              {showAddColumn && !showCustomForm && (
                <SmartColumnPicker
                  entityType={tab.value}
                  existingKeys={new Set(sortedColumns.map(c => c.key))}
                  onSelect={(col) => addColumn({ ...col, visible: true, order: sortedColumns.length, width: 120 })}
                  onCreateCustom={() => setShowCustomForm(true)}
                />
              )}

              {showCustomForm && (
                <CustomColumnForm
                  entityType={tab.value}
                  onAdd={(col) => addColumn(col)}
                  onCancel={() => { setShowCustomForm(false); setShowAddColumn(false); }}
                />
              )}

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {sortedColumns.map((col, idx) => {
                  const label = col.label ?? builtinLabels[col.key] ?? col.key;
                  const isBuiltin = builtinKeys.includes(col.key) || col.key.startsWith("computed:");
                  const canMoveUp = idx > 0;
                  const canMoveDown = idx < sortedColumns.length - 1;
                  const typeBadge = col.type ?? (col.key.startsWith("custom:") ? "text" : col.key.startsWith("computed:") ? "computed" : null);

                  return (
                    <div
                      key={col.key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        col.visible
                          ? "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 opacity-60"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                          disabled={!canMoveUp}
                          onClick={() => moveColumn(col.key, "up")}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                          disabled={!canMoveDown}
                          onClick={() => moveColumn(col.key, "down")}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>

                      <GripVertical className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600 shrink-0 cursor-grab" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{label}</span>
                          {typeBadge && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[typeBadge] ?? TYPE_COLORS.text}`}>
                              {typeBadge}
                            </span>
                          )}
                          {isBuiltin && (
                            <span className="text-[10px] text-zinc-400">built-in</span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono">{col.key}</span>
                      </div>

                      <Switch
                        checked={col.visible}
                        onCheckedChange={(checked) => updateColumn(col.key, { visible: checked })}
                        className="shrink-0"
                      />

                      {!isBuiltin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-zinc-400 hover:text-red-500 shrink-0"
                          onClick={() => removeColumn(col.key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-3">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
