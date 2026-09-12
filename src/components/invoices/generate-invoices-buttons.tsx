"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  generateMissingSalesInvoices,
  generateMissingPurchaseInvoices,
} from "@/lib/actions/invoices";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";

export function GenerateInvoicesButtons({
  canManageInvoices,
}: {
  canManageInvoices: boolean;
}) {
  const { language } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!canManageInvoices) {
    return (
      <p className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
        {language === "ur"
          ? "آپ کو انوائس جنریٹ کرنے کی اجازت نہیں ہے۔"
          : "You do not have permission to generate invoices."}
      </p>
    );
  }

  function handleGenerateSales() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await generateMissingSalesInvoices();
        setFeedback(
          language === "ur"
            ? `${result.created || 0} سیلز انوائسز بنائیں گئیں۔`
            : `${result.created || 0} sales invoice(s) generated.`
        );
        router.refresh();
      } catch (err) {
        setFeedback(
          err instanceof Error
            ? err.message
            : language === "ur"
              ? "انوائسز بنانے میں ناکامی"
              : "Failed to generate invoices."
        );
      }
    });
  }

  function handleGeneratePurchase() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await generateMissingPurchaseInvoices();
        setFeedback(
          language === "ur"
            ? `${result.created || 0} پرچیز انوائسز بنائیں گئیں۔`
            : `${result.created || 0} purchase invoice(s) generated.`
        );
        router.refresh();
      } catch (err) {
        setFeedback(
          err instanceof Error
            ? err.message
            : language === "ur"
              ? "انوائسز بنانے میں ناکامی"
              : "Failed to generate invoices."
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleGenerateSales}
        >
          {isPending
            ? language === "ur"
              ? "بنائیں جا رہی ہیں..."
              : "Generating..."
            : language === "ur"
              ? "سیلز انوائسز بنائیں"
              : "Generate Sales Invoices"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={handleGeneratePurchase}
        >
          {isPending
            ? language === "ur"
              ? "بنائیں جا رہی ہیں..."
              : "Generating..."
            : language === "ur"
              ? "پرچیز انوائسز بنائیں"
              : "Generate Purchase Invoices"}
        </Button>
      </div>
      {feedback && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">{feedback}</p>
      )}
    </div>
  );
}
