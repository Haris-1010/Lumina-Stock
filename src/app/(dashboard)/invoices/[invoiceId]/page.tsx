import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceDeleteButton } from "@/components/invoices/invoice-delete-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getInvoiceDetailsForCurrentOrganization,
  recordManualInvoicePayment,
} from "@/lib/actions/invoices";
import { getServerLanguage } from "@/lib/i18n-server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { InvoicePrintButton } from "@/components/invoices/invoice-print-button";

function toSingle(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

type PageParams = Promise<{ invoiceId: string }>;
type SearchParamsType = Promise<Record<string, string | string[] | undefined>>;

export default async function InvoiceDetailsPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParamsType;
}) {
  const language = await getServerLanguage();
  const { invoiceId } = await params;
  const details = await getInvoiceDetailsForCurrentOrganization(invoiceId);

  if (!details) notFound();

  const profile = await getCurrentUserWithPermissions();
  const org = profile?.user.organization;

  const paramsData = await searchParams;
  const paymentState = toSingle(paramsData.payment);
  const paymentReason = toSingle(paramsData.reason);

  async function recordPaymentAction(formData: FormData) {
    "use server";
    await recordManualInvoicePayment(formData);
  }

  const labels =
    language === "ur"
      ? {
          back: "انوائسز پر واپس",
          references: "حوالہ",
          items: "آئٹمز",
          payments: "ادائیگیاں",
          manualPayment: "دستی ادائیگی ریکارڈ کریں",
          amount: "رقم",
          method: "طریقہ",
          transactionRef: "ٹرانزیکشن ریفرنس",
          submit: "ادائیگی محفوظ کریں",
          paid: "اداشدہ",
          balance: "بقایا",
          issueDate: "اجراء تاریخ",
          dueDate: "واجب الادا تاریخ",
          status: "اسٹیٹس",
          supplier: "سپلائر",
          orderRef: "آرڈر ریفرنس",
          success: "ادائیگی کامیابی سے ریکارڈ ہوگئی۔",
          failed: "ادائیگی محفوظ نہیں ہوسکی۔",
          processing: "ادائیگی کی تصدیق جاری ہے۔",
          print: "پرنٹ کریں",
        }
      : {
          back: "Back to Invoices",
          references: "References",
          items: "Line Items",
          payments: "Payment History",
          manualPayment: "Record Manual Payment",
          amount: "Amount",
          method: "Method",
          transactionRef: "Transaction Reference",
          submit: "Save Payment",
          paid: "Paid",
          balance: "Balance Due",
          issueDate: "Issue Date",
          dueDate: "Due Date",
          status: "Status",
          supplier: "Supplier / Party",
          orderRef: "Order Reference",
          success: "Payment has been recorded.",
          failed: "Payment could not be recorded.",
          processing: "Payment verification is in progress.",
          print: "Print Invoice",
        };

  const statusBadge =
    details.status === "PAID" ? (
      <Badge variant="success">{details.status}</Badge>
    ) : details.status === "OVERDUE" ? (
      <Badge variant="destructive">{details.status}</Badge>
    ) : details.status === "PARTIALLY_PAID" ? (
      <Badge variant="warning">{details.status}</Badge>
    ) : (
      <Badge variant="default">{details.status}</Badge>
    );

  const canDelete =
    details.paidAmount <= 0 &&
    details.status !== "PAID" &&
    details.status !== "PARTIALLY_PAID";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4" />
              {labels.back}
            </Link>
          </Button>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{details.invoiceNumber}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{details.type}</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {statusBadge}
          {/* Print button — client component */}
          <InvoicePrintButton
            details={details}
            orgName={org?.name ?? ""}
            orgLogoUrl={org?.logoUrl ?? null}
            orgPhone={org?.phone ?? null}
            orgAddress={org?.address ?? null}
            language={language}
            label={labels.print}
          />
          <InvoiceDeleteButton
            invoiceId={details.id}
            invoiceNumber={details.invoiceNumber}
            canDelete={canDelete}
            language={language}
          />
        </div>
      </div>

      {paymentState === "success" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{labels.success}</p>
      )}
      {paymentState === "failed" && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {paymentReason ? `${labels.failed} ${paymentReason}` : labels.failed}
        </p>
      )}
      {paymentState === "processing" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {paymentReason ? `${labels.processing} ${paymentReason}` : labels.processing}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.issueDate}</CardDescription>
            <CardTitle className="text-lg">{formatDate(details.issueDate)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.dueDate}</CardDescription>
            <CardTitle className="text-lg">{details.dueDate ? formatDate(details.dueDate) : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.paid}</CardDescription>
            <CardTitle className="text-lg text-emerald-600">{formatCurrency(details.paidAmount)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.balance}</CardDescription>
            <CardTitle className={`text-lg ${details.balanceAmount > 0 ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}>
              {formatCurrency(details.balanceAmount)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.references}</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <div><span className="text-zinc-400">{labels.status}: </span><span className="font-medium">{details.status}</span></div>
          <div><span className="text-zinc-400">{labels.supplier}: </span><span className="font-medium">{details.supplierName || "—"}</span></div>
          <div><span className="text-zinc-400">{labels.orderRef}: </span><span className="font-medium">{details.salesOrderNumber || details.purchaseOrderNumber || "—"}</span></div>
          <div><span className="text-zinc-400">Currency: </span><span className="font-medium">{details.currency}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.items}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-zinc-400">{item.sku || "—"}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-zinc-50 dark:bg-zinc-800/40 font-semibold">
                <TableCell colSpan={4} className="text-right text-sm">Total</TableCell>
                <TableCell className="text-right text-sm">{formatCurrency(details.totalAmount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.payments}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell>{payment.gateway}</TableCell>
                    <TableCell>{payment.status}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {details.payments.length === 0 && (
              <p className="pt-3 text-sm text-zinc-500">{language === "ur" ? "ابھی کوئی ادائیگی نہیں" : "No payments recorded yet."}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.manualPayment}</CardTitle>
            <CardDescription>
              {language === "ur"
                ? "بینک ٹرانسفر یا نقد ادائیگی کو دستی طور پر ریکارڈ کریں۔"
                : "Record an offline bank transfer or cash payment manually."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={recordPaymentAction} className="space-y-4">
              <input type="hidden" name="invoiceId" value={details.id} />
              <div className="space-y-2">
                <Label htmlFor="amount">{labels.amount}</Label>
                <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">{labels.method}</Label>
                <select id="method" name="method" className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="WALLET">Wallet</option>
                  <option value="MOBILE_WALLET">Mobile Wallet (JazzCash / Easypaisa)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transactionRef">{labels.transactionRef}</Label>
                <Input id="transactionRef" name="transactionRef" placeholder="Bank ref / txn id" />
              </div>
              <Button type="submit" className="w-full" disabled={details.balanceAmount <= 0}>
                {labels.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
