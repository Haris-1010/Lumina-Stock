import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AccountTransactionEntry } from "@/types";

function statusBadge(status: AccountTransactionEntry["status"], language: "en" | "ur") {
  const labelsUr: Record<AccountTransactionEntry["status"], string> = {
    PENDING: "زیرِ التواء",
    COMPLETED: "کامیاب",
    FAILED: "ناکام",
    REFUNDED: "واپس",
    CANCELLED: "منسوخ",
  };

  const text = language === "ur" ? labelsUr[status] : status;

  if (status === "COMPLETED") return <Badge variant="success">{text}</Badge>;
  if (status === "FAILED" || status === "CANCELLED") {
    return <Badge variant="destructive">{text}</Badge>;
  }
  if (status === "PENDING") return <Badge variant="warning">{text}</Badge>;
  return <Badge variant="secondary">{text}</Badge>;
}

function formatSender(entry: AccountTransactionEntry, language: "en" | "ur") {
  const unknown = language === "ur" ? "نامعلوم" : "Unknown";
  const name = entry.senderName || unknown;
  const account = entry.senderAccount ? ` (${entry.senderAccount})` : "";
  return `${name}${account}`;
}

function formatReceiver(entry: AccountTransactionEntry, language: "en" | "ur") {
  const unknown = language === "ur" ? "نامعلوم" : "Unknown";
  const name = entry.receiverName || unknown;
  const account = entry.receiverAccount ? ` (${entry.receiverAccount})` : "";
  return `${name}${account}`;
}

function directionBadge(direction: AccountTransactionEntry["direction"], language: "en" | "ur") {
  const label =
    direction === "INCOMING"
      ? language === "ur"
        ? "موصول"
        : "Received"
      : language === "ur"
        ? "ارسال"
        : "Sent";

  if (direction === "INCOMING") {
    return <Badge variant="success">{label}</Badge>;
  }

  return <Badge variant="warning">{label}</Badge>;
}

export function PaymentNotifications({
  entries,
  language,
}: {
  entries: AccountTransactionEntry[];
  language: "en" | "ur";
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {language === "ur"
          ? "ابھی تک کوئی ادائیگی ایکٹیویٹی موجود نہیں۔"
          : "No payment activity yet."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const signedPrefix = entry.direction === "INCOMING" ? "+" : "-";
        const amountClass = entry.direction === "INCOMING" ? "text-emerald-700" : "text-amber-700";

        return (
          <div
            key={entry.id}
            className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{entry.gateway}</Badge>
                {directionBadge(entry.direction, language)}
                {statusBadge(entry.status, language)}
              </div>
              <p className="text-xs text-zinc-500">{formatDate(entry.occurredAt)}</p>
            </div>

            <div className="mt-2 grid gap-1 text-sm text-zinc-700 md:grid-cols-2">
              <p>
                {language === "ur" ? "بھیجنے والا" : "Sender"}: {formatSender(entry, language)}
              </p>
              <p>
                {language === "ur" ? "رقم" : "Amount"}: <span className={`font-semibold ${amountClass}`}>{signedPrefix}{formatCurrency(entry.amount)} {entry.currency}</span>
              </p>
              <p>
                {language === "ur" ? "سمت" : "Direction"}: {entry.direction}
              </p>
              <p>
                {language === "ur" ? "ٹرانزیکشن ریف" : "Transaction Ref"}: {entry.transactionRef || "-"}
              </p>
              <p>
                {language === "ur" ? "سورس" : "Source"}: {entry.source}
              </p>
              <p>
                {language === "ur" ? "وصول کنندہ" : "Receiver"}: {formatReceiver(entry, language)}
              </p>
            </div>

            {entry.invoiceId && (
              <p className="mt-2 text-sm">
                {language === "ur" ? "متعلقہ انوائس" : "Linked invoice"}: {" "}
                <Link href={`/invoices/${entry.invoiceId}`} className="font-medium text-zinc-900 underline">
                  {entry.invoiceNumber || entry.invoiceId}
                </Link>
              </p>
            )}

            {entry.description && (
              <p className="mt-2 text-xs text-zinc-600">{entry.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
