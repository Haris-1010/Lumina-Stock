"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteInvoiceForCurrentOrganization } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteInvoiceResult {
  success?: boolean;
  invoiceNumber?: string;
  error?: string;
}

interface InvoiceDeleteButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  canDelete: boolean;
  language: "en" | "ur";
}

export function InvoiceDeleteButton({
  invoiceId,
  invoiceNumber,
  canDelete,
  language,
}: InvoiceDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const labels =
    language === "ur"
      ? {
          trigger: "حذف",
          triggerDisabled: "حذف دستیاب نہیں",
          title: "انوائس حذف کریں",
          description: "یہ انوائس مستقل طور پر حذف ہو جائے گی۔",
          warning: "جزوی یا مکمل ادا شدہ انوائس حذف نہیں کی جا سکتی۔",
          blockedReason: "یہ انوائس ادا شدہ ہے، اس لیے حذف نہیں کی جا سکتی۔",
          cancel: "منسوخ",
          confirm: "حذف کریں",
        }
      : {
          trigger: "Delete",
          triggerDisabled: "Delete Unavailable",
          title: "Delete Invoice",
          description: "This invoice will be permanently deleted.",
          warning: "Partially or fully paid invoices cannot be deleted.",
          blockedReason: "This invoice has payments and cannot be deleted.",
          cancel: "Cancel",
          confirm: "Delete",
        };

  function handleDelete() {
    if (!canDelete || isPending) return;

    setFeedback(null);

    startTransition(async () => {
      const result = (await deleteInvoiceForCurrentOrganization(invoiceId)) as DeleteInvoiceResult;

      if (result?.error) {
        setFeedback(result.error);
        return;
      }

      setOpen(false);
      router.push("/invoices");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        variant="destructive"
        size="sm"
        disabled={!canDelete || isPending}
        onClick={() => {
          setFeedback(null);
          setOpen(true);
        }}
        title={!canDelete ? labels.blockedReason : undefined}
      >
        <Trash2 className="h-4 w-4" />
        {canDelete ? labels.trigger : labels.triggerDisabled}
      </Button>

      {!canDelete && <p className="text-xs text-zinc-500">{labels.blockedReason}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.title}</DialogTitle>
            <DialogDescription>{labels.description}</DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-700">
            <p>{invoiceNumber}</p>
          </div>

          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {labels.warning}
          </p>

          {feedback && (
            <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {feedback}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {labels.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending || !canDelete}>
              {isPending ? "..." : labels.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}