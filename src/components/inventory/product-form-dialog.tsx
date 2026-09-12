"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/providers/i18n-provider";
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
import {
  createProductForCurrentOrganization,
  updateProductForCurrentOrganization,
  type ProductFormInput,
} from "@/lib/actions/inventory";

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category: string;
  niche?: string | null;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  reorderPoint: number;
  leadTimeDays: number;
  supplier: { id?: string; name: string } | null;
  supplierId?: string | null;
  expiresAt?: Date | string | null;
}

const PRODUCT_NICHE_KEYS = [
  "electronics", "fruits_vegetables", "dry_fruits_nuts", "medicine_pharmacy",
  "clothing_apparel", "shoes_footwear", "groceries_food", "cosmetics_beauty",
  "stationery_office", "hardware_tools", "construction_materials", "automotive",
  "sports_fitness", "software_digital", "furniture_home", "other",
] as const;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  suppliers: Supplier[];
  onSuccess: (product: { id: string; isNew: boolean }) => void;
}

const EMPTY_FORM: ProductFormInput = {
  sku: "",
  name: "",
  description: "",
  category: "",
  niche: null,
  currentStock: 0,
  costPrice: 0,
  sellingPrice: 0,
  reorderPoint: 10,
  leadTimeDays: 7,
  supplierId: null,
  expiresAt: null,
};

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  suppliers,
  onSuccess,
}: ProductFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormInput>(EMPTY_FORM);
  const { t, language } = useI18n();

  const isEditing = Boolean(product);

  useEffect(() => {
    if (open) {
      setError(null);
      if (product) {
        // Format expiresAt date to YYYY-MM-DD for the date input
        let expiresAtStr: string | null = null;
        if (product.expiresAt) {
          const d = new Date(product.expiresAt);
          expiresAtStr = d.toISOString().slice(0, 10);
        }
        setForm({
          sku: product.sku,
          name: product.name,
          description: product.description || "",
          category: product.category,
          niche: product.niche ?? null,
          currentStock: product.currentStock,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          reorderPoint: product.reorderPoint,
          leadTimeDays: product.leadTimeDays,
          supplierId: (product as { supplierId?: string | null }).supplierId ?? null,
          expiresAt: expiresAtStr,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, product]);

  function setField<K extends keyof ProductFormInput>(key: K, value: ProductFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = isEditing
        ? await updateProductForCurrentOrganization(product!.id, form)
        : await createProductForCurrentOrganization(form);

      if (result.error) {
        setError(result.error);
        return;
      }

      onSuccess({ id: result.productId!, isNew: !isEditing });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? (language === "ur" ? "مصنوع میں ترمیم" : "Edit Product")
              : (language === "ur" ? "نئی مصنوع شامل کریں" : "Add New Product")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? (language === "ur" ? "نیچے مصنوع کی تفصیل اپ ڈیٹ کریں۔" : "Update the product details below.")
              : (language === "ur" ? "مصنوع کی تفصیل بھریں۔" : "Fill in the product details to add it to your inventory.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Row 1: SKU + Name */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-sku">SKU *</Label>
              <Input
                id="pf-sku"
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value)}
                placeholder={language === "ur" ? "مثال: PROD-001" : "e.g. PROD-001"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">{language === "ur" ? "مصنوع کا نام *" : "Product Name *"}</Label>
              <Input
                id="pf-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder={language === "ur" ? "مثال: وائرلیس ہیڈفونز" : "e.g. Wireless Headphones"}
                required
              />
            </div>
          </div>

          {/* Row 2: Company + Niche */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-category">{language === "ur" ? "کمپنی *" : "Company *"}</Label>
              <Input
                id="pf-category"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                placeholder={language === "ur" ? "مثال: کاجو، سام سنگ ٹی وی" : "e.g. Cashews, Samsung TVs"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-niche">{t("product.niche.label")}</Label>
              <Select
                value={form.niche ?? "__none__"}
                onValueChange={(val) =>
                  setField("niche", val === "__none__" ? null : val)
                }
              >
                <SelectTrigger id="pf-niche">
                  <SelectValue placeholder={language === "ur" ? "نوع منتخب کریں..." : "Select niche..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === "ur" ? "— غیر متعین —" : "— Not set —"}</SelectItem>
                  {PRODUCT_NICHE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`product.niche.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">{t("product.niche.hint")}</p>
            </div>
          </div>

          {/* Row 2b: Supplier */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-supplier">{language === "ur" ? "سپلائر" : "Supplier"}</Label>
              <Select
                value={form.supplierId ?? "__none__"}
                onValueChange={(val) =>
                  setField("supplierId", val === "__none__" ? null : val)
                }
              >
                <SelectTrigger id="pf-supplier">
                  <SelectValue placeholder={language === "ur" ? "کوئی سپلائر نہیں" : "No supplier"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === "ur" ? "کوئی سپلائر نہیں" : "No supplier"}</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Cost + Selling Price */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-cost">{language === "ur" ? "لاگت قیمت *" : "Cost Price *"}</Label>
              <Input
                id="pf-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setField("costPrice", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-selling">{language === "ur" ? "فروخت قیمت *" : "Selling Price *"}</Label>
              <Input
                id="pf-selling"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) => setField("sellingPrice", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Row 4: Stock + Reorder Point + Lead Time */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pf-stock">{language === "ur" ? "موجودہ اسٹاک" : "Current Stock"}</Label>
              <Input
                id="pf-stock"
                type="number"
                min="0"
                step="1"
                value={form.currentStock}
                onChange={(e) => setField("currentStock", parseInt(e.target.value, 10) || 0)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-reorder">{language === "ur" ? "ری آرڈر پوائنٹ" : "Reorder Point"}</Label>
              <Input
                id="pf-reorder"
                type="number"
                min="0"
                step="1"
                value={form.reorderPoint}
                onChange={(e) => setField("reorderPoint", parseInt(e.target.value, 10) || 0)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-lead">{language === "ur" ? "لیڈ ٹائم (دن)" : "Lead Time (days)"}</Label>
              <Input
                id="pf-lead"
                type="number"
                min="1"
                step="1"
                value={form.leadTimeDays}
                onChange={(e) => setField("leadTimeDays", parseInt(e.target.value, 10) || 7)}
                placeholder="7"
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-expires">
                {language === "ur" ? "میعاد ختم ہونے کی تاریخ (اختیاری)" : "Expiry Date (optional)"}
              </Label>
              <Input
                id="pf-expires"
                type="date"
                value={form.expiresAt ?? ""}
                onChange={(e) => setField("expiresAt", e.target.value || null)}
              />
              <p className="text-xs text-zinc-500">
                {language === "ur" ? "خراب ہونے والی اشیاء کے لیے — الرٹ ملیں گے" : "For perishables — get alerts before expiry"}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="pf-desc">{language === "ur" ? "تفصیل (اختیاری)" : "Description (optional)"}</Label>
            <Input
              id="pf-desc"
              value={form.description || ""}
              onChange={(e) => setField("description", e.target.value)}
              placeholder={language === "ur" ? "مصنوع کی مختصر تفصیل..." : "Brief product description..."}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {language === "ur" ? "منسوخ" : "Cancel"}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? (language === "ur" ? "محفوظ ہو رہا ہے..." : isEditing ? "Saving..." : "Adding...")
                : isEditing
                ? (language === "ur" ? "تبدیلیاں محفوظ کریں" : "Save Changes")
                : (language === "ur" ? "مصنوع شامل کریں" : "Add Product")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
