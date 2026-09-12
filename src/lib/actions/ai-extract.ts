"use server";

import { extractProductsFromText } from "@/lib/import/ai-extractor";
import { requireActionPermission } from "@/lib/permissions";

/**
 * Server action: Extract product data from freeform text using AI.
 * Wraps the ai-extractor so client components don't need to import server-only code.
 */
export async function extractProductsAction(text: string) {
  await requireActionPermission("csvImport");
  return extractProductsFromText(text);
}
