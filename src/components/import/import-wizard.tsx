"use client";

import { useReducer, useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SourceStep } from "./source-step";
import { MappingStep } from "./mapping-step";
import { ReviewStep } from "./review-step";
import { ResultStep } from "./result-step";
import { ProgressBar } from "./progress-bar";
import { parseFile, detectFormat } from "@/lib/import/parser";
import { extractProductsAction } from "@/lib/actions/ai-extract";
import { validateRows } from "@/lib/import/validator";
import { executeImport } from "@/lib/import/executor";
import type {
  EntityType,
  ParsedRow,
  ColumnMapping,
  ValidatedRow,
  ImportResult,
} from "@/lib/column-config/types";

// ── State ─────────────────────────────────────────────────────────

type Step = "source" | "mapping" | "review" | "result";

interface WizardState {
  step: Step;
  headers: string[];
  rows: ParsedRow[];
  mappings: ColumnMapping[];
  validatedRows: ValidatedRow[];
  result: ImportResult | null;
  isParsing: boolean;
  isExtracting: boolean;
  isImporting: boolean;
  error: string | null;
  progress: { processed: number; total: number; phase: string } | null;
}

type WizardAction =
  | { type: "SET_PARSING"; payload: boolean }
  | { type: "SET_EXTRACTING"; payload: boolean }
  | { type: "PARSE_COMPLETE"; payload: { headers: string[]; rows: ParsedRow[] } }
  | { type: "EXTRACT_COMPLETE"; payload: { headers: string[]; rows: ParsedRow[] } }
  | { type: "SET_ERROR"; payload: string }
  | { type: "MAP_COMPLETE"; payload: { mappings: ColumnMapping[]; validatedRows: ValidatedRow[] } }
  | { type: "SET_IMPORTING"; payload: boolean }
  | { type: "SET_PROGRESS"; payload: WizardState["progress"] }
  | { type: "IMPORT_COMPLETE"; payload: ImportResult }
  | { type: "GO_BACK" }
  | { type: "RESET" };

const initialState: WizardState = {
  step: "source",
  headers: [],
  rows: [],
  mappings: [],
  validatedRows: [],
  result: null,
  isParsing: false,
  isExtracting: false,
  isImporting: false,
  error: null,
  progress: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_PARSING":
      return { ...state, isParsing: action.payload, error: null };
    case "SET_EXTRACTING":
      return { ...state, isExtracting: action.payload, error: null };
    case "PARSE_COMPLETE":
      return {
        ...state,
        step: "mapping",
        headers: action.payload.headers,
        rows: action.payload.rows,
        isParsing: false,
        error: null,
      };
    case "EXTRACT_COMPLETE":
      return {
        ...state,
        step: "mapping",
        headers: action.payload.headers,
        rows: action.payload.rows,
        isExtracting: false,
        error: null,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isParsing: false,
        isExtracting: false,
        isImporting: false,
      };
    case "MAP_COMPLETE":
      return {
        ...state,
        step: "review",
        mappings: action.payload.mappings,
        validatedRows: action.payload.validatedRows,
        error: null,
      };
    case "SET_IMPORTING":
      return { ...state, isImporting: action.payload };
    case "SET_PROGRESS":
      return { ...state, progress: action.payload };
    case "IMPORT_COMPLETE":
      return {
        ...state,
        step: "result",
        result: action.payload,
        isImporting: false,
        progress: null,
      };
    case "GO_BACK": {
      const stepOrder: Step[] = ["source", "mapping", "review", "result"];
      const currentIdx = stepOrder.indexOf(state.step);
      return {
        ...state,
        step: stepOrder[Math.max(0, currentIdx - 1)],
        error: null,
      };
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ── Step indicator ────────────────────────────────────────────────

const STEPS: { key: Step; label: string; num: number }[] = [
  { key: "source", label: "Source", num: 1 },
  { key: "mapping", label: "Mapping", num: 2 },
  { key: "review", label: "Review", num: 3 },
  { key: "result", label: "Result", num: 4 },
];

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center gap-1 px-1">
      {STEPS.map((s, i) => {
        const isActive = s.key === currentStep;
        const isCompleted = i < currentIdx;

        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isCompleted
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
              }`}
            >
              {isCompleted ? "✓" : s.num}
            </div>
            <span
              className={`text-[10px] font-medium ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : isCompleted
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-400"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 h-px ${
                  isCompleted ? "bg-emerald-400" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Wizard Component ─────────────────────────────────────────

interface ImportWizardProps {
  entityType: EntityType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportWizard({ entityType, open, onOpenChange }: ImportWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // ── Step 1: Parse source ──────────────────────────────────────

  const handleSourceReady = useCallback(
    async (source: { type: "file" | "paste" | "ai"; data: File | string }) => {
      try {
        if (source.type === "file") {
          dispatch({ type: "SET_PARSING", payload: true });
          const file = source.data as File;
          const format = detectFormat(file);
          const parsed = await parseFile(file, format);
          dispatch({ type: "PARSE_COMPLETE", payload: parsed });
        } else if (source.type === "paste") {
          dispatch({ type: "SET_PARSING", payload: true });
          const text = source.data as string;
          const blob = new Blob([text], { type: "text/plain" });
          const file = new File([blob], "pasted.txt", { type: "text/plain" });
          const parsed = await parseFile(file, "txt");
          dispatch({ type: "PARSE_COMPLETE", payload: parsed });
        } else if (source.type === "ai") {
          dispatch({ type: "SET_EXTRACTING", payload: true });
          const text = source.data as string;
          const result = await extractProductsAction(text);
          dispatch({
            type: "EXTRACT_COMPLETE",
            payload: {
              headers: result.headers,
              rows: result.rows.map((r, i) => ({ rowIndex: i, raw: r })),
            },
          });
        }
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: (err as Error).message });
      }
    },
    []
  );

  // ── Step 2→3: Mapping → Review (with validation) ──────────────

  const handleMapped = useCallback(
    (mappings: ColumnMapping[]) => {
      // Run validation on mapped rows
      const validated = validateRows(state.rows, mappings, new Set(), entityType);
      dispatch({ type: "MAP_COMPLETE", payload: { mappings, validatedRows: validated } });
    },
    [state.rows, entityType]
  );

  // ── Step 3→4: Import ──────────────────────────────────────────

  const handleImport = useCallback(
    async (selectedRows: ValidatedRow[]) => {
      dispatch({ type: "SET_IMPORTING", payload: true });
      dispatch({
        type: "SET_PROGRESS",
        payload: { processed: 0, total: selectedRows.length, phase: "Importing..." },
      });

      try {
        const result = await executeImport(entityType, selectedRows, "", "");
        dispatch({ type: "IMPORT_COMPLETE", payload: result });
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: (err as Error).message });
      }
    },
    [entityType]
  );

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const handleBack = useCallback(() => {
    dispatch({ type: "GO_BACK" });
  }, []);

  const isLoading = state.isParsing || state.isExtracting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              Import {entityType === "inventory" ? "Products" : entityType === "customers" ? "Customers" : "Suppliers"}
            </DialogTitle>
            <StepIndicator currentStep={state.step} />
          </div>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Error banner */}
          {state.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 px-4 py-3">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                {state.error}
              </p>
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-sm text-zinc-500">
                {state.isExtracting
                  ? "AI is extracting products from your text..."
                  : "Parsing your file..."}
              </p>
            </div>
          )}

          {/* Progress bar during import */}
          {!isLoading && state.progress && (
            <div className="mb-4">
              <ProgressBar
                processed={state.progress.processed}
                total={state.progress.total}
                phase={state.progress.phase}
              />
            </div>
          )}

          {/* Step content — only render the active step */}
          {!isLoading && state.step === "source" && (
            <SourceStep entityType={entityType} onSourceReady={handleSourceReady} />
          )}

          {!isLoading && state.step === "mapping" && state.headers.length > 0 && (
            <MappingStep
              headers={state.headers}
              rows={state.rows}
              entityType={entityType}
              onBack={handleBack}
              onMapped={handleMapped}
            />
          )}

          {!isLoading && state.step === "review" && state.validatedRows.length > 0 && (
            <ReviewStep
              rows={state.validatedRows}
              mappings={state.mappings}
              entityType={entityType}
              onBack={handleBack}
              onImport={handleImport}
              isImporting={state.isImporting}
            />
          )}

          {!isLoading && state.step === "result" && state.result && (
            <ResultStep
              result={state.result}
              entityType={entityType}
              onReset={handleReset}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
