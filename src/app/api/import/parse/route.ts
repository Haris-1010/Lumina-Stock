import { NextRequest, NextResponse } from "next/server";
import { parseFile, detectFormat } from "@/lib/import/parser";
import type { FileFormat } from "@/lib/column-config/types";

/**
 * POST /api/import/parse
 * Accepts multipart form data with a file, parses it, and returns headers + rows.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const formatOverride = formData.get("format") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const format = (formatOverride as FileFormat) || detectFormat(file);
    const { headers, rows } = await parseFile(file, format);

    return NextResponse.json({
      success: true,
      format,
      fileName: file.name,
      headers,
      rowCount: rows.length,
      rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to parse file" },
      { status: 400 }
    );
  }
}
