// ── Column Configuration Types ────────────────────────────────────

export type ColumnType = "text" | "number" | "currency" | "date" | "select" | "boolean" | "computed";

export type EntityType = "inventory" | "customers" | "suppliers";

export interface ColumnConfig {
  /** Column key — "sku" for built-in, "custom:brand" for custom, "computed:margin" for computed */
  key: string;
  visible: boolean;
  order: number;
  /** Width in px for CSS grid template */
  width: number;
  /** Display header text (overrides built-in label) */
  label?: string;
  // ── Only set on custom/computed columns ──
  type?: ColumnType;
  /** For select type: list of valid options */
  options?: string[];
  /** For computed type: formula identifier */
  formula?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface EntityColumnConfig {
  columns: ColumnConfig[];
}

export interface OrgColumnConfigs {
  inventory?: EntityColumnConfig;
  customers?: EntityColumnConfig;
  suppliers?: EntityColumnConfig;
}

// ── Smart Column Catalog ────────────────────────────────────────

export interface SmartColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  group: string;
  options?: string[];
  formula?: string;
  description: string;
}

// ── Import-related types (re-exported for convenience) ──────────

export type ImportSource = "file" | "paste" | "ai";
export type FileFormat = "csv" | "tsv" | "xlsx" | "json" | "txt";

export interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
}

export interface ImportError {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: "number" | "currency" | "date" | "trim" | "uppercase";
  isCustom: boolean;
}

export interface ValidatedRow {
  rowIndex: number;
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  errors: ImportError[];
  isDuplicate: boolean;
  action: "create" | "update";
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ rowIndex: number; errors: ImportError[] }>;
}

export interface ImportTemplate {
  id: string;
  name: string;
  entityType: string;
  mappings: ColumnMapping[];
  sampleHeaders: string[];
}
