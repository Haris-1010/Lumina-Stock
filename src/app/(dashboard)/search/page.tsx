import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireOrganization } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerLanguage } from "@/lib/i18n-server";
import { formatCurrency } from "@/lib/utils";

type SearchParamsType = Promise<Record<string, string | string[] | undefined>>;

function toSingle(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParamsType;
}) {
  const language = await getServerLanguage();

  let org;
  try {
    org = await requireOrganization();
  } catch {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "تلاش" : "Search"}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {language === "ur"
            ? "تلاش کے لیے پہلے سائن اِن کریں۔"
            : "Sign in to use global search."}
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const q = (toSingle(params.q) || "").trim();

  if (!q) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "تلاش" : "Search"}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {language === "ur"
            ? "اوپر والے سرچ باکس میں مطلوبہ لفظ لکھیں۔"
            : "Type a keyword in the header search box."}
        </p>
      </div>
    );
  }

  // Sequential: PgBouncer connection_limit=1 — parallel queries risk pool timeout.
  const products = await db.product.findMany({
    where: {
      organizationId: org.id,
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      currentStock: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  const invoices = await db.invoice.findMany({
    where: {
      organizationId: org.id,
      OR: [
        { invoiceNumber: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { salesOrder: { orderNumber: { contains: q, mode: "insensitive" } } },
        { purchaseOrder: { poNumber: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      type: true,
    },
    orderBy: { issueDate: "desc" },
    take: 20,
  });
  const purchaseOrders = await db.purchaseOrder.findMany({
    where: {
      organizationId: org.id,
      OR: [
        { poNumber: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
      select: {
        id: true,
        poNumber: true,
        status: true,
        totalCost: true,
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

  const total = products.length + invoices.length + purchaseOrders.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {language === "ur" ? "تلاش کے نتائج" : "Search Results"}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {language === "ur"
            ? `"${q}" کے لیے ${total} نتائج ملے۔`
            : `${total} result(s) found for "${q}".`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === "ur" ? "مصنوعات" : "Products"}</CardTitle>
          <CardDescription>{language === "ur" ? "انوینٹری سے مماثل آئٹمز" : "Matching inventory items"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {products.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{language === "ur" ? "کوئی نتیجہ نہیں" : "No matches"}</p>
          ) : (
            products.map((item) => (
              <Link
                key={item.id}
                href={`/inventory`}
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm hover:bg-zinc-100"
              >
                <div>
                  <p className="font-medium text-zinc-900">{item.name}</p>
                  <p className="text-xs text-zinc-500">{item.sku} • {item.category}</p>
                </div>
                <Badge variant="secondary">{item.currentStock}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === "ur" ? "انوائسز" : "Invoices"}</CardTitle>
          <CardDescription>{language === "ur" ? "ادائیگی اور بلنگ ریکارڈز" : "Payment and billing records"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{language === "ur" ? "کوئی نتیجہ نہیں" : "No matches"}</p>
          ) : (
            invoices.map((item) => (
              <Link
                key={item.id}
                href={`/invoices/${item.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm hover:bg-zinc-100"
              >
                <div>
                  <p className="font-medium text-zinc-900">{item.invoiceNumber}</p>
                  <p className="text-xs text-zinc-500">{item.type} • {item.status}</p>
                </div>
                <p className="text-sm font-medium text-zinc-700">{formatCurrency(item.totalAmount)}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === "ur" ? "پرچیز آرڈرز" : "Purchase Orders"}</CardTitle>
          <CardDescription>{language === "ur" ? "ری اسٹاکنگ آرڈرز" : "Restocking orders"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {purchaseOrders.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{language === "ur" ? "کوئی نتیجہ نہیں" : "No matches"}</p>
          ) : (
            purchaseOrders.map((item) => (
              <Link
                key={item.id}
                href="/purchase-orders"
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm hover:bg-zinc-100"
              >
                <div>
                  <p className="font-medium text-zinc-900">{item.poNumber}</p>
                  <p className="text-xs text-zinc-500">{item.supplier?.name || "-"} • {item.status}</p>
                </div>
                <p className="text-sm font-medium text-zinc-700">{formatCurrency(item.totalCost)}</p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
