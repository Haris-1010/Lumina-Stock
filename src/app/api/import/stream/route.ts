import { NextRequest } from "next/server";
import { parseFile, detectFormat } from "@/lib/import/parser";
import { validateRows } from "@/lib/import/validator";
import { executeImport } from "@/lib/import/executor";
import { logImport } from "@/lib/actions/import-log";
import { autoMapColumns } from "@/lib/import/mapper";
import type { FileFormat, ColumnMapping } from "@/lib/column-config/types";

/**
 * POST /api/import/stream
 * Accepts multipart form data with a file, parses it, validates rows,
 * and returns an SSE stream that emits progress events as rows are imported.
 *
 * Body (multipart):
 *   file: File
 *   entityType: "inventory" | "customers" | "suppliers"
 *   mappings?: string (JSON-encoded ColumnMapping[])
 *   organizationId: string
 *   userId: string
 *
 * SSE events:
 *   data: {"phase":"parsing","message":"Parsing file..."}
 *   data: {"phase":"validating","total":500,"message":"Validating rows..."}
 *   data: {"phase":"importing","processed":100,"total":500}
 *   data: {"phase":"complete","created":450,"updated":30,"errors":20,"total":500}
 *   data: {"phase":"error","message":"..."}
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const entityType = (formData.get("entityType") as string) || "inventory";
        const mappingsJson = formData.get("mappings") as string | null;
        const organizationId = (formData.get("organizationId") as string) || "";
        const userId = (formData.get("userId") as string) || "";

        if (!file) {
          sendEvent({ phase: "error", message: "No file provided" });
          controller.close();
          return;
        }

        // Phase 1: Parse
        sendEvent({ phase: "parsing", message: "Parsing file..." });
        const format = detectFormat(file);
        const { headers, rows } = await parseFile(file, format);

        // Phase 2: Map & Validate
        sendEvent({ phase: "validating", total: rows.length, message: "Validating rows..." });

        let mappings: ColumnMapping[];
        if (mappingsJson) {
          mappings = JSON.parse(mappingsJson);
        } else {
          mappings = autoMapColumns(headers, entityType as "inventory" | "customers" | "suppliers");
        }

        const validatedRows = validateRows(
          rows,
          mappings,
          new Set(),
          entityType as "inventory" | "customers" | "suppliers"
        );

        // Filter to only valid rows (no errors)
        const importableRows = validatedRows.filter((r) => r.errors.length === 0);

        if (importableRows.length === 0) {
          sendEvent({
            phase: "complete",
            created: 0,
            updated: 0,
            errors: validatedRows.length,
            total: rows.length,
            message: "No valid rows to import",
          });
          controller.close();
          return;
        }

        // Phase 3: Import with progress
        sendEvent({ phase: "importing", processed: 0, total: importableRows.length });

        const CHUNK_SIZE = 100;
        let totalCreated = 0;
        let totalUpdated = 0;
        let totalErrors = 0;

        for (let i = 0; i < importableRows.length; i += CHUNK_SIZE) {
          const chunk = importableRows.slice(i, i + CHUNK_SIZE);

          const result = await executeImport(
            entityType as "inventory" | "customers" | "suppliers",
            chunk,
            organizationId,
            userId
          );

          totalCreated += result.created;
          totalUpdated += result.updated;
          totalErrors += result.errors.length;

          sendEvent({
            phase: "importing",
            processed: Math.min(i + CHUNK_SIZE, importableRows.length),
            total: importableRows.length,
            created: totalCreated,
            updated: totalUpdated,
            errors: totalErrors,
          });
        }

        // Log the import
        try {
          await logImport({
            entityType,
            source: format,
            fileName: file.name,
            totalRows: rows.length,
            created: totalCreated,
            updated: totalUpdated,
            skipped: rows.length - importableRows.length,
            errors: totalErrors,
          });
        } catch {
          // Logging failure shouldn't break the import
        }

        // Phase 4: Complete
        sendEvent({
          phase: "complete",
          created: totalCreated,
          updated: totalUpdated,
          errors: totalErrors + (validatedRows.length - importableRows.length),
          total: rows.length,
        });

        controller.close();
      } catch (err) {
        sendEvent({ phase: "error", message: (err as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
