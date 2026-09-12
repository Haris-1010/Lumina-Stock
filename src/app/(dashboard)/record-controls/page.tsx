import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { RecordControlsClient } from "@/components/record-controls/record-controls-client";
import { db } from "@/lib/db";
import { getServerLanguage } from "@/lib/i18n-server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

type SearchParamsType = Promise<Record<string, string | string[] | undefined>>;

function toSingle(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseIds(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  ).slice(0, 500);
}

export default async function RecordControlsPage({
  searchParams,
}: {
  searchParams: SearchParamsType;
}) {
  const language = await getServerLanguage();
  const profile = await getCurrentUserWithPermissions();

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "ریکارڈ کنٹرولز" : "Record Controls"}
        </h1>
        <EmptyState
          title={language === "ur" ? "لاگ اِن درکار" : "Sign in required"}
          description={
            language === "ur"
              ? "ریکارڈ اپڈیٹس کے لیے سائن اِن کریں۔"
              : "Sign in to manage record updates."
          }
          showSampleCsv
        />
      </div>
    );
  }

  const { user, permissions } = profile;

  const canAccess = permissions.pages.recordControls;
  const canManage = permissions.actions.recordControlsManage;

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "ریکارڈ کنٹرولز" : "Record Controls"}
        </h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {language === "ur" ? "رسائی محدود" : "Access restricted"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {language === "ur"
                ? "آپ کو اس سیکشن تک رسائی کی اجازت نہیں ہے۔"
                : "You do not have permission to access this section."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const source = toSingle(params.source) || "inventory";
  const idsRaw = toSingle(params.ids) || "";
  const ids = parseIds(idsRaw);

  if (ids.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "ریکارڈ کنٹرولز" : "Record Controls"}
        </h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {language === "ur"
                ? "پہلے Inventory, Forecasts یا Dead Stock میں ریکارڈز منتخب کریں، پھر Edit Selected Records پر کلک کریں۔"
                : "Select records in Inventory, Forecasts, or Dead Stock and click Edit Selected Records."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const records = await db.product.findMany({
    where: {
      organizationId: user.organizationId,
      id: { in: ids },
    },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      currentStock: true,
      reorderPoint: true,
      leadTimeDays: true,
      costPrice: true,
      sellingPrice: true,
    },
    orderBy: { name: "asc" },
  });

  if (records.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "ریکارڈ کنٹرولز" : "Record Controls"}
        </h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {language === "ur"
                ? "منتخب ریکارڈز دستیاب نہیں یا آپ کے ادارے سے متعلق نہیں۔"
                : "Selected records are unavailable or not part of your organization."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "ریکارڈ کنٹرولز" : "Record Controls"}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {language === "ur"
            ? "منتخب ریکارڈز پر ایک ساتھ اپڈیٹس لاگو کریں۔"
            : "Apply controlled updates to selected records."}
        </p>
      </div>

      <RecordControlsClient records={records} source={source} canManage={canManage} />
    </div>
  );
}
