import { NextRequest, NextResponse } from "next/server";
import { getApiOrganization } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import Papa from "papaparse";
import {
  formatLimit,
  getPlanDefinition,
  getRemainingLimit,
  wouldExceedLimit,
} from "@/lib/subscription";

function parseIntOrDefault(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatOrDefault(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  const profile = await getCurrentUserWithPermissions();
  if (profile && !profile.permissions.actions.csvImport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await getApiOrganization(request);
  if (!org) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const text = await file.text();
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "CSV parse errors", details: errors }, { status: 400 });
  }

  const uniqueSkus = Array.from(
    new Set(
      data
        .map((row) => (row.sku || row.SKU || "").trim())
        .filter((sku) => sku.length > 0)
    )
  );

  if (uniqueSkus.length === 0) {
    return NextResponse.json(
      { error: "CSV does not include any valid SKU values." },
      { status: 400 }
    );
  }

  const plan = getPlanDefinition(org.subscriptionStatus);

  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const existingProducts = await db.product.findMany({
    where: {
      organizationId: org.id,
      sku: { in: uniqueSkus },
    },
    select: { sku: true },
  });
  const currentProductCount = await db.product.count({ where: { organizationId: org.id } });

  const existingSkuSet = new Set(existingProducts.map((product) => product.sku));
  const newProductCount = uniqueSkus.filter((sku) => !existingSkuSet.has(sku)).length;

  if (wouldExceedLimit(plan.maxProducts, currentProductCount, newProductCount)) {
    const remaining = getRemainingLimit(plan.maxProducts, currentProductCount) ?? 0;

    return NextResponse.json(
      {
        error: `Import would add ${newProductCount} new products, but your ${plan.displayName} plan has ${remaining} slot(s) remaining out of ${formatLimit(plan.maxProducts)}.`,
      },
      { status: 403 }
    );
  }

  let imported = 0;
  for (const row of data) {
    const sku = (row.sku || row.SKU || "").trim();
    const name = (row.name || row.Name || row.product_name || "").trim();
    if (!sku || !name) continue;

    const stockValue = row.stock || row.current_stock;
    const costValue = row.cost_price || row.cost;
    const sellingValue = row.selling_price || row.price;
    const leadTimeValue = row.lead_time;
    const reorderPointValue = row.reorder_point;

    await db.product.upsert({
      where: { sku_organizationId: { sku, organizationId: org.id } },
      create: {
        sku,
        name,
        description: row.description || "",
        category: row.category || "Uncategorized",
        currentStock: parseIntOrDefault(stockValue, 0),
        costPrice: parseFloatOrDefault(costValue, 0),
        sellingPrice: parseFloatOrDefault(sellingValue, 0),
        leadTimeDays: parseIntOrDefault(leadTimeValue, 7),
        reorderPoint: parseIntOrDefault(reorderPointValue, 10),
        organizationId: org.id,
      },
      update: {
        name,
        description: row.description || undefined,
        category: row.category || undefined,
        currentStock: stockValue ? parseIntOrDefault(stockValue, 0) : undefined,
        costPrice: costValue ? parseFloatOrDefault(costValue, 0) : undefined,
        sellingPrice: sellingValue ? parseFloatOrDefault(sellingValue, 0) : undefined,
        leadTimeDays: leadTimeValue ? parseIntOrDefault(leadTimeValue, 7) : undefined,
        reorderPoint: reorderPointValue ? parseIntOrDefault(reorderPointValue, 10) : undefined,
      },
    });
    imported++;
  }

  return NextResponse.json({ success: true, imported });
}
