"use client";

import { useState, useRef } from "react";
import { Upload, Clipboard, Sparkles, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { detectFormat } from "@/lib/import/parser";
import type { FileFormat } from "@/lib/column-config/types";

interface SourceStepProps {
  entityType: "inventory" | "customers" | "suppliers";
  onSourceReady: (source: { type: "file" | "paste" | "ai"; data: File | string }) => void;
}

const FORMAT_LABELS: Record<FileFormat, string> = {
  csv: "CSV",
  tsv: "TSV",
  xlsx: "Excel (.xlsx)",
  json: "JSON",
  txt: "Plain Text",
};

export function SourceStep({ entityType, onSourceReady }: SourceStepProps) {
  const [activeTab, setActiveTab] = useState<"file" | "paste" | "ai">("file");
  const [pasteText, setPasteText] = useState("");
  const [aiText, setAiText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }

  function handleContinue() {
    if (activeTab === "file" && selectedFile) {
      onSourceReady({ type: "file", data: selectedFile });
    } else if (activeTab === "paste" && pasteText.trim()) {
      onSourceReady({ type: "paste", data: pasteText });
    } else if (activeTab === "ai" && aiText.trim()) {
      onSourceReady({ type: "ai", data: aiText });
    }
  }

  const canContinue =
    (activeTab === "file" && !!selectedFile) ||
    (activeTab === "paste" && pasteText.trim().length > 0) ||
    (activeTab === "ai" && aiText.trim().length > 0);

  const entityLabel = entityType === "inventory" ? "products" : entityType === "customers" ? "customers" : "suppliers";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Choose Data Source
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Import {entityLabel} from a file, pasted text, or let AI extract them from an invoice/bill.
        </p>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2">
        {[
          { key: "file" as const, icon: Upload, label: "Upload File" },
          { key: "paste" as const, icon: Clipboard, label: "Paste Text" },
          { key: "ai" as const, icon: Sparkles, label: "AI Extract" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* File Upload */}
      {activeTab === "file" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.xlsx,.xls,.json,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          {selectedFile ? (
            <>
              {selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls") ? (
                <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
              ) : (
                <FileText className="h-8 w-8 text-blue-500" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{selectedFile.name}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB · {FORMAT_LABELS[detectFormat(selectedFile)]}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                Choose Different File
              </Button>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-zinc-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  CSV, TSV, Excel (.xlsx), JSON, or plain text
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Paste Text */}
      {activeTab === "paste" && (
        <div>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Paste your ${entityType === "inventory" ? "product list, invoice, bill, or receipt" : entityType === "customers" ? "customer list" : "supplier list"} here...\n\nExample:\nSKU-001  Widget A  100  25.00  45.00\nSKU-002  Widget B  50   30.00  55.00`}
            className="min-h-[200px] font-mono text-xs"
          />
          <p className="text-[11px] text-zinc-400 mt-1">
            {pasteText.trim().split("\n").filter(Boolean).length} line(s) detected
          </p>
        </div>
      )}

      {/* AI Extract */}
      {activeTab === "ai" && (
        <div>
          <Textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder={`Paste an invoice, bill, receipt, or any text containing ${entityLabel}.\n\nThe AI will extract all items with names, quantities, prices, and other details.\n\nExample:\nInvoice #1234 from ABC Suppliers:\n- Cement 50kg bags x 10 @ Rs. 850 = Rs. 8,500\n- Steel rods 12mm x 20 @ Rs. 1,200 = Rs. 24,000\n- Sand (per truck) x 2 @ Rs. 15,000 = Rs. 30,000`}
            className="min-h-[200px] text-xs"
          />
          <div className="flex items-center gap-2 mt-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-[11px] text-zinc-400">
              AI will extract product data from bills, invoices, and receipts
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          size="sm"
        >
          Parse & Map →
        </Button>
      </div>
    </div>
  );
}
