"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPORTED_CURRENCIES,
  normalizeCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/currency";
import { updateOrganizationCurrencyForCurrentOrganization } from "@/lib/actions/organization-settings";

export function CurrencySettings({
  language,
  initialCurrencyCode,
  canManageCurrency,
}: {
  language: "en" | "ur";
  initialCurrencyCode: string;
  canManageCurrency: boolean;
}) {
  const [currencyCode, setCurrencyCode] = useState<SupportedCurrencyCode>(
    normalizeCurrencyCode(initialCurrencyCode)
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const labels = useMemo(
    () =>
      language === "ur"
        ? {
            title: "گلوبل کرنسی",
            description: "پورے ادارے کے لیے ڈیفالٹ کرنسی منتخب کریں۔",
            selectLabel: "کرنسی منتخب کریں",
            save: "کرنسی محفوظ کریں",
            saving: "محفوظ کیا جا رہا ہے...",
            updated: "گلوبل کرنسی اپ ڈیٹ ہو گئی۔",
            noPermission: "آپ کو گلوبل کرنسی اپ ڈیٹ کرنے کی اجازت نہیں ہے۔",
          }
        : {
            title: "Global Currency",
            description: "Set a default currency for your entire organization.",
            selectLabel: "Choose Currency",
            save: "Save Currency",
            saving: "Saving...",
            updated: "Global currency updated.",
            noPermission: "You do not have permission to update global currency.",
          },
    [language]
  );

  function handleSave() {
    if (!canManageCurrency) {
      setFeedback(labels.noPermission);
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      const result = await updateOrganizationCurrencyForCurrentOrganization({
        currencyCode,
      });

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback(labels.updated);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{labels.description}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] space-y-1">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {labels.selectLabel}
          </p>
          <Select
            value={currencyCode}
            onValueChange={(value) => setCurrencyCode(normalizeCurrencyCode(value))}
            disabled={!canManageCurrency}
          >
            <SelectTrigger>
              <SelectValue placeholder={labels.selectLabel} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.code} - {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={!canManageCurrency || isPending}>
          <Save className="h-4 w-4" />
          {isPending ? labels.saving : labels.save}
        </Button>
      </div>

      {!canManageCurrency && (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
          {labels.noPermission}
        </p>
      )}

      {feedback && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {feedback}
        </p>
      )}
    </div>
  );
}
