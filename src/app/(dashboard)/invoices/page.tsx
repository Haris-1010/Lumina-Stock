import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag, PackageCheck, FileText, CreditCard, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { InvoicesClient } from "@/components/invoices/invoices-client";
import { GenerateInvoicesButtons } from "@/components/invoices/generate-invoices-buttons";
import { PageHelp } from "@/components/ui/page-help";
import { PaymentNotifications } from "@/components/invoices/payment-notifications";
import { requireOrganization } from "@/lib/auth";
import {
  listRecentAccountTransactionsForCurrentOrganization,
  listInvoicesForCurrentOrganization,
} from "@/lib/actions/invoices";
import { getServerLanguage } from "@/lib/i18n-server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

function toSingle(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

type SearchParamsType = Promise<Record<string, string | string[] | undefined>>;

export default async function InvoicesPage({
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
          {language === "ur" ? "انوائس" : "Invoices"}
        </h1>
        <EmptyState
          title={language === "ur" ? "کوئی ادارہ منتخب نہیں" : "No organization selected"}
          description={
            language === "ur"
              ? "انوائسز دیکھنے کے لیے سائن اِن کریں اور ادارہ منتخب کریں۔"
              : "Sign in and select an organization to view invoices."
          }
          showSampleCsv
        />
      </div>
    );
  }

  const params = await searchParams;
  const paymentState = toSingle(params.payment);
  const paymentReason = toSingle(params.reason);

  const permissionProfile = await getCurrentUserWithPermissions();
  const canManageInvoices = Boolean(permissionProfile?.permissions.actions.invoicesManage);
  const canDeleteInvoices = Boolean(permissionProfile?.permissions.actions.invoicesDelete);
  const canManageInvoicePayments = Boolean(
    permissionProfile?.permissions.actions.invoicePaymentsManage
  );

  const invoices = await listInvoicesForCurrentOrganization();
  const recentTransactions = await listRecentAccountTransactionsForCurrentOrganization(12);

  const summary = {
    total: invoices.length,
    paid: invoices.filter((invoice) => invoice.status === "PAID").length,
    overdue: invoices.filter((invoice) => invoice.status === "OVERDUE").length,
    outstanding: invoices.filter((invoice) => invoice.balanceAmount > 0).length,
  };

  const labels =
    language === "ur"
      ? {
          title: "انوائسز اور ادائیگیاں",
          subtitle:
            "اپنی تمام سیلز اور پرچیز انوائسز دیکھیں، ڈاؤن لوڈ کریں، اور عالمی/مقامی گیٹ ویز کے ذریعے ادائیگی منظم کریں۔",
          generateSales: "سیلز انوائسز بنائیں",
          generatePurchase: "پرچیز انوائسز بنائیں",
          total: "کل",
          paid: "ادا شدہ",
          overdue: "بقایاجات",
          outstanding: "واجب الادا",
          success: "ادائیگی کامیابی سے ریکارڈ ہوگئی۔",
          failed: "ادائیگی مکمل نہیں ہوسکی۔",
          processing: "ادائیگی کی تصدیق جاری ہے۔ چند لمحوں میں اسٹیٹس اپ ڈیٹ ہو جائے گا۔",
          notifications: "ادائیگی ایکٹیویٹی",
          notificationsSub: "JazzCash / EasyPaisa سے موصولہ اور ارسال شدہ رقم کی اپڈیٹس",
        }
      : {
          title: "Invoices & Payments",
          subtitle:
            "View, save and manage all sales and purchase invoices with global and local payment gateways.",
          generateSales: "Generate Sales Invoices",
          generatePurchase: "Generate Purchase Invoices",
          total: "Total",
          paid: "Paid",
          overdue: "Overdue",
          outstanding: "Outstanding",
          success: "Payment completed successfully.",
          failed: "Payment could not be completed.",
          processing: "Payment verification is in progress. Status will update shortly.",
          notifications: "Payment Activity",
          notificationsSub: "Live received and sent amount updates from JazzCash and EasyPaisa",
        };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{labels.title}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{labels.subtitle}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{org.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp
            title="Invoices Guide"
            purpose="Invoices are formal billing documents. Sales invoices are issued to customers when goods are sold. Purchase invoices are received from suppliers when you buy stock. They track how much is owed and have been paid."
            sections={[
              {
                title: "How invoices are created",
                items: [
                  "Click 'Generate Sales Invoices' to auto-create invoices from recent cashier sales.",
                  "Click 'Generate Purchase Invoices' to auto-create invoices from received purchase orders.",
                  "Or create a manual invoice for custom billing scenarios.",
                ],
              },
              {
                title: "Invoice statuses",
                items: [
                  "DRAFT — not yet finalised or sent.",
                  "ISSUED — sent to the customer or supplier.",
                  "PARTIALLY PAID — some payment received but balance remains.",
                  "PAID — fully settled.",
                  "OVERDUE — past due date with unpaid balance.",
                  "CANCELLED — invoice voided.",
                ],
              },
              {
                title: "Payments",
                items: [
                  "Record payments via Cash, Bank Transfer, JazzCash, or EasyPaisa.",
                  "JazzCash and EasyPaisa transactions appear in real-time in the payment feed.",
                ],
              },
            ]}
            aiTips={[
              "How much revenue did I earn this month?",
              "Which invoices are overdue?",
              "Show me all unpaid purchase invoices",
            ]}
          />
          <GenerateInvoicesButtons canManageInvoices={canManageInvoices} />
        </div>
      </div>

      {/* Workflow banner */}
      <Card className="border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/30">
        <CardContent className="py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
            Invoice flow
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-violet-800 dark:text-violet-300">
            <span className="flex items-center gap-1.5 rounded-md bg-violet-100 px-2.5 py-1 font-medium dark:bg-violet-900/50">
              <ShoppingBag className="h-3.5 w-3.5" />
              Sale / PO Received
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-violet-100 px-2.5 py-1 font-medium dark:bg-violet-900/50">
              <FileText className="h-3.5 w-3.5" />
              Generate Invoice
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-violet-100 px-2.5 py-1 font-medium dark:bg-violet-900/50">
              <CreditCard className="h-3.5 w-3.5" />
              Record Payment
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
            <span className="flex items-center gap-1.5 rounded-md bg-violet-100 px-2.5 py-1 font-medium dark:bg-violet-900/50">
              <PackageCheck className="h-3.5 w-3.5" />
              Marked Paid
            </span>
          </div>
          <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">
            Click <strong>Generate Sales Invoices</strong> after cashier sales, or <strong>Generate Purchase Invoices</strong> after receiving a PO. Then record payments via Cash, Bank Transfer, JazzCash, or EasyPaisa.
          </p>
        </CardContent>
      </Card>

      {paymentState === "success" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {labels.success}
        </p>
      )}

      {paymentState === "failed" && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {paymentReason ? `${labels.failed} ${paymentReason}` : labels.failed}
        </p>
      )}

      {paymentState === "processing" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {labels.processing}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.notifications}</CardTitle>
          <CardDescription>{labels.notificationsSub}</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentNotifications entries={recentTransactions} language={language} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.total}</CardDescription>
            <CardTitle className="text-2xl">{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.paid}</CardDescription>
            <CardTitle className="text-2xl">{summary.paid}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.overdue}</CardDescription>
            <CardTitle className="text-2xl">{summary.overdue}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.outstanding}</CardDescription>
            <CardTitle className="text-2xl">{summary.outstanding}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "ur" ? "تمام انوائسز" : "All Invoices"}
          </CardTitle>
          <CardDescription>
            {language === "ur"
              ? "فہرست، فلٹر، ڈاؤن لوڈ اور گیٹ وے ادائیگی مینجمنٹ"
              : "List, filter, download and pay through supported gateways"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoicesClient
            invoices={invoices}
            canDeleteInvoices={canDeleteInvoices}
            canManageInvoicePayments={canManageInvoicePayments}
          />
        </CardContent>
      </Card>

    </div>
  );
}
