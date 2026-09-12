"use client";

import * as XLSX from "xlsx";

/**
 * Exports an array of row objects to an Excel file and triggers a browser download.
 *
 * @param data - Array of objects where keys become column headers
 * @param filename - Download filename (without .xlsx extension)
 * @param sheetName - Name of the worksheet (defaults to "Sheet1")
 */
export function exportToExcel(
  data: Record<string, any>[],
  filename: string,
  sheetName: string = "Sheet1"
) {
  if (!data.length) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-width columns
  const colWidths = Object.keys(data[0]).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...data.map((row) => String(row[key] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
