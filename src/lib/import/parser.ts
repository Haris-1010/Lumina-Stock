import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedRow, FileFormat } from "@/lib/column-config/types";

/**
 * Parse a file into headers + rows. Supports CSV, TSV, Excel, JSON, and plain text.
 */
export async function parseFile(
  file: File,
  format: FileFormat
): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  switch (format) {
    case "csv":
    case "tsv":
      return parseCSV(await file.text(), format === "tsv" ? "\t" : undefined);
    case "xlsx":
      return parseExcel(await file.arrayBuffer());
    case "json":
      return parseJSON(await file.text());
    case "txt":
      return parseText(await file.text());
    default:
      throw new Error(`Unsupported file format: ${format}`);
  }
}

/**
 * Detect file format from extension or MIME type.
 */
export function detectFormat(file: File): FileFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".tsv")) return "tsv";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".txt")) return "txt";

  // Fallback by MIME
  if (file.type.includes("spreadsheet") || file.type.includes("excel")) return "xlsx";
  if (file.type.includes("json")) return "json";
  if (file.type.includes("tab-separated")) return "tsv";

  return "csv"; // Default
}

/**
 * Parse CSV/TSV text with PapaParse.
 */
function parseCSV(
  text: string,
  delimiter?: string
): { headers: string[]; rows: ParsedRow[] } {
  // Auto-detect delimiter if not specified
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter ?? undefined,
    dynamicTyping: false, // Keep everything as strings for mapping
    transformHeader: (h: string) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  const rows: ParsedRow[] = result.data.map((row, idx) => ({
    rowIndex: idx,
    raw: row as Record<string, string>,
  }));

  return { headers, rows };
}

/**
 * Parse Excel file (.xlsx/.xls) using SheetJS.
 */
function parseExcel(
  buffer: ArrayBuffer
): { headers: string[]; rows: ParsedRow[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel file has no sheets");

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  if (jsonData.length === 0) return { headers: [], rows: [] };

  // First row is headers
  const headers = jsonData[0].map(String);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i];
    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      raw[headers[j]] = rowData[j] !== undefined && rowData[j] !== null ? String(rowData[j]) : "";
    }
    rows.push({ rowIndex: i - 1, raw });
  }

  return { headers, rows };
}

/**
 * Parse JSON — supports array of objects, array of arrays, or nested structure.
 */
function parseJSON(
  text: string
): { headers: string[]; rows: ParsedRow[] } {
  const parsed = JSON.parse(text);

  // Array of objects (most common)
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
    const first = parsed[0];
    if (Array.isArray(first)) {
      // Array of arrays — first array is headers
      const headers = first.map(String);
      const rows: ParsedRow[] = [];
      for (let i = 1; i < parsed.length; i++) {
        const raw: Record<string, string> = {};
        for (let j = 0; j < headers.length; j++) {
          raw[headers[j]] = parsed[i][j] !== undefined ? String(parsed[i][j]) : "";
        }
        rows.push({ rowIndex: i - 1, raw });
      }
      return { headers, rows };
    }

    // Array of objects
    const headers = Object.keys(first);
    const rows: ParsedRow[] = parsed.map((obj, idx) => {
      const raw: Record<string, string> = {};
      for (const key of headers) {
        raw[key] = obj[key] !== undefined ? String(obj[key]) : "";
      }
      return { rowIndex: idx, raw };
    });
    return { headers, rows };
  }

  // Single object — wrap in array
  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    // Try nested: { "products": [...] } or { "data": [...] }
    const arrayKey = Object.keys(parsed).find(
      (k) => Array.isArray(parsed[k]) && parsed[k].length > 0
    );
    if (arrayKey) {
      return parseJSON(JSON.stringify(parsed[arrayKey]));
    }
  }

  throw new Error("JSON structure not recognized. Expected an array of objects or arrays.");
}

/**
 * Parse plain text — smart detection of tab-separated, pipe-separated, or comma-separated.
 */
function parseText(
  text: string
): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("Text must have at least 2 lines (header + data)");
  }

  // Detect delimiter by counting occurrences in first 5 lines
  const sampleLines = lines.slice(0, Math.min(5, lines.length));
  const delimiters = [
    { char: "\t", name: "tab" },
    { char: "|", name: "pipe" },
    { char: ",", name: "comma" },
    { char: ";", name: "semicolon" },
  ];

  let best = delimiters[2]; // default comma
  let bestCount = 0;

  for (const d of delimiters) {
    const count = sampleLines.reduce(
      (sum, line) => sum + (line.split(d.char).length - 1),
      0
    );
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }

  return parseCSV(text, best.char);
}
