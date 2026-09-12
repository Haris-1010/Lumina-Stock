"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adjustStockForCurrentOrganization } from "@/lib/actions/inventory";

interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; sku: string; currentStock: number } | null;
  onSuccess: (productId: string, newStock: number) => void;
}

type ChangeType = "RESTOCK" | "MANUAL" | "RETURN";

export function StockAdjustDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: StockAdjustDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [changeType, setChangeType] = useState<ChangeType>("RESTOCK");
  const [quantity, setQuantity] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (open) {
      setError(null);
      setChangeType("RESTOCK");
      setQuantity("");
      setNote("");
    }
  }, [open]);

  if (!product) return null;

  const qty = parseInt(quantity, 10);
  const previewStock =
    !isNaN(qty) && qty > 0
      ? changeType === "MANUAL"
        ? qty
        : changeType === "RESTOCK" || changeType === "RETURN"
        ? product.currentStock + qty
        : product.currentStock - qty
      : product.currentStock;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setError(null);

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError("Please enter a valid quantity greater than 0.");
      return;
    }

    startTransition(async () => {
      const result = await adjustStockForCurrentOrganization(
        product.id,
        changeType,
        parsedQty,
        note.trim() || undefined
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess(product.id, result.newStock ?? previewStock);
      onOpenChange(false);
    });
  }

  const changeTypeLabel: Record<ChangeType, string> = {
    RESTOCK: "Restock (add units)",
    MANUAL: "Manual override (set absolute)",
    RETURN: "Return (add units back)",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {product.name} <span className="font-mono text-xs text-zinc-400">({product.sku})</span>
            <br />
            Current stock: <strong>{product.currentStock} units</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sa-type">Adjustment Type</Label>
            <Select value={changeType} onValueChange={(v) => setChangeType(v as ChangeType)}>
              <SelectTrigger id="sa-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(changeTypeLabel) as [ChangeType, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sa-qty">
              {changeType === "MANUAL" ? "New Stock Value" : "Quantity"}
            </Label>
            <Input
              id="sa-qty"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={changeType === "MANUAL" ? "New total stock" : "Units"}
              required
            />
          </div>

          {!isNaN(qty) && qty > 0 && (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
              After adjustment: <strong>{previewStock} units</strong>
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sa-note">Note (optional)</Label>
            <Input
              id="sa-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Received shipment from supplier"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Apply Adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
