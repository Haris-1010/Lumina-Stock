"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Shared hook for CSV file import via the /api/csv-upload endpoint.
 *
 * Encapsulates the boilerplate that both InventoryImportControls and
 * CsvImportControl duplicated (FormData, fetch, error handling, refresh).
 *
 * @param messages  Localized success/error strings the component wants shown.
 */
export function useCsvImport(messages: {
  success: (count: number) => string;
  error: (fallback: string) => string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function handleCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/csv-upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { imported?: number; error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || messages.error("Import failed.") });
      } else {
        setMsg({ ok: true, text: messages.success(data.imported ?? 0) });
        startTransition(() => router.refresh());
      }
    } catch {
      setMsg({ ok: false, text: messages.error("Import failed. Check the CSV format.") });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return { handleCsv, busy, msg, fileRef };
}
