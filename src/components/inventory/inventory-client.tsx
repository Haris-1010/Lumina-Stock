"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Search, Filter, Edit3, Trash2, Plus, PackagePlus, QrCode, Upload, CheckSquare,
  Package, Cpu, Apple, Pill, Shirt, ShoppingBag, Flower2,
  PenTool, Wrench, Car, Dumbbell, Monitor, Home, MoreHorizontal, Building2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { TablePagination } from "@/components/ui/table-pagination";
import { useI18n } from "@/components/providers/i18n-provider";
import { withUrduMeaning } from "@/lib/urdu-glossary";
import { deleteProductsForCurrentOrganization } from "@/lib/actions/inventory";
import { ProductFormDialog } from "./product-form-dialog";
import { InventoryImportControls } from "./inventory-import-controls";
import { StockAdjustDialog } from "./stock-adjust-dialog";
import { ProductQRDialog } from "./product-qr-dialog";
import { ImportWizard } from "@/components/import/import-wizard";
import { ColumnSettingsDialog } from "@/components/column-config/column-settings-dialog";
import { DynamicCellValue } from "@/components/column-config/dynamic-column-renderer";
import { resolveColumnConfig, getVisibleColumns } from "@/lib/column-config/resolver";
import type { OrgColumnConfigs } from "@/lib/column-config/types";

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
  supplierId?: string | null;
  supplier: { name: string } | null;
  expiresAt?: Date | string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
}

interface Supplier {
  id: string;
  name: string;
}

interface DeleteProductsResult {
  success?: boolean;
  deleted?: number;
  error?: string;
  blocked?: Array<{ id: string; sku: string; name: string; salesRefs: number; purchaseRefs: number }>;
}

// ─── Niche visual config ──────────────────────────────────────────────────────
const NICHE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  electronics:         { icon: Cpu,         color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-l-blue-400" },
  fruits_vegetables:   { icon: Apple,       color: "text-green-600",   bg: "bg-green-50 dark:bg-green-950/30",  border: "border-l-green-400" },
  dry_fruits_nuts:     { icon: Package,     color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30",  border: "border-l-amber-400" },
  medicine_pharmacy:   { icon: Pill,        color: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/30",      border: "border-l-red-400" },
  clothing_apparel:    { icon: Shirt,       color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-950/30",border: "border-l-purple-400" },
  shoes_footwear:      { icon: ShoppingBag, color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-950/30",border: "border-l-orange-400" },
  groceries_food:      { icon: ShoppingBag, color: "text-lime-600",    bg: "bg-lime-50 dark:bg-lime-950/30",    border: "border-l-lime-400" },
  cosmetics_beauty:    { icon: Flower2,     color: "text-pink-600",    bg: "bg-pink-50 dark:bg-pink-950/30",    border: "border-l-pink-400" },
  stationery_office:   { icon: PenTool,     color: "text-sky-600",     bg: "bg-sky-50 dark:bg-sky-950/30",      border: "border-l-sky-400" },
  hardware_tools:      { icon: Wrench,      color: "text-zinc-600",    bg: "bg-zinc-100 dark:bg-zinc-800/40",   border: "border-l-zinc-400" },
  construction_materials: { icon: Building2, color: "text-stone-600",  bg: "bg-stone-100 dark:bg-stone-800/40", border: "border-l-stone-400" },
  automotive:          { icon: Car,         color: "text-slate-600",   bg: "bg-slate-50 dark:bg-slate-950/30",  border: "border-l-slate-400" },
  sports_fitness:      { icon: Dumbbell,    color: "text-teal-600",    bg: "bg-teal-50 dark:bg-teal-950/30",    border: "border-l-teal-400" },
  software_digital:    { icon: Monitor,     color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30",border: "border-l-indigo-400" },
  furniture_home:      { icon: Home,        color: "text-yellow-600",  bg: "bg-yellow-50 dark:bg-yellow-950/30",border: "border-l-yellow-400" },
  other:               { icon: MoreHorizontal, color: "text-zinc-500", bg: "bg-zinc-50 dark:bg-zinc-900",       border: "border-l-zinc-300" },
};

function getNicheConfig(niche: string | null | undefined) {
  return NICHE_CONFIG[niche ?? "other"] ?? NICHE_CONFIG.other;
}

// ─── Expiry badge ─────────────────────────────────────────────────────────────
function ExpiryBadge({ expiresAt }: { expiresAt?: Date | string | null }) {
  if (!expiresAt) return null;
  const now = new Date();
  const exp = new Date(expiresAt);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0)
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800">EXPIRED</span>;
  if (daysLeft <= 7)
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800">{daysLeft}d left</span>;
  if (daysLeft <= 30)
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800">{daysLeft}d</span>;
  return null;
}

// ─── Stock pill ───────────────────────────────────────────────────────────────
function StockPill({ stock, reorderPoint, t }: { stock: number; reorderPoint: number; t: ReturnType<typeof useI18n>["t"] }) {
  if (stock === 0)
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />{t("inventory.status.outOfStock")}</span>;
  if (stock <= reorderPoint)
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />{t("inventory.status.lowStock")}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />{t("inventory.status.inStock")}</span>;
}

export function InventoryClient({
  initialProducts,
  categories,
  suppliers,
  currencyCode,
  canEditInventory,
  canDeleteInventory,
  initialSupplierFilter = "all",
  columnConfigs,
}: {
  initialProducts: Product[];
  categories: string[];
  suppliers: Supplier[];
  organizationId: string;
  currencyCode: string;
  canEditInventory: boolean;
  canDeleteInventory: boolean;
  canUseRecordControls: boolean;
  initialSupplierFilter?: string;
  orgNiche?: string;
  columnConfigs?: OrgColumnConfigs;
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState(initialSupplierFilter);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [isPending, startTransition] = useTransition();
  const { t, language } = useI18n();

  // Dialogs
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<{ id: string; sku: string; name: string } | null>(null);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // ── Column configuration ───────────────────────────────────────────
  const entityConfig = useMemo(() => resolveColumnConfig("inventory", columnConfigs), [columnConfigs]);
  const visibleColumns = useMemo(() => getVisibleColumns(entityConfig), [entityConfig]);
  const isUr = language === "ur";
  const lbl = useMemo(() => ({
    addProduct:   isUr ? "نئی پروڈکٹ" : "Add Product",
    editProduct:  isUr ? "ترمیم" : "Edit",
    adjustStock:  isUr ? "اسٹاک" : "Stock",
    qrCode:       isUr ? "QR" : "QR",
    deleteOne:    isUr ? "حذف" : "Delete",
    deleteTitle:  isUr ? "پروڈکٹ حذف کریں" : "Delete Product",
    deleteDesc:   isUr ? "منتخب پروڈکٹ ری سائیکل بن میں جائے گی۔" : "Selected product(s) will be moved to the recycle bin.",
    deleteWarn:   isUr ? "فروخت یا خریداری سے منسلک مصنوعات حذف نہیں ہوں گی۔" : "Products linked to sales or purchase records cannot be deleted.",
    cancel:       isUr ? "منسوخ" : "Cancel",
    confirm:      isUr ? "بن میں منتقل کریں" : "Move to Bin",
    deleted:      (n: number) => isUr ? `${n} پروڈکٹ حذف ہوئی۔` : `${n} product(s) moved to bin.`,
    blockedPfx:   isUr ? "بلاک:" : "Blocked:",
    showing:      isUr ? "دکھائے جا رہے ہیں" : "Showing",
    of:           isUr ? "میں سے" : "of",
    rowsPerPage:  isUr ? "قطاریں" : "Rows",
    page:         isUr ? "صفحہ" : "Page",
    previous:     isUr ? "پچھلا" : "Previous",
    next:         isUr ? "اگلا" : "Next",
    sku:          "SKU",
    product:      isUr ? "پروڈکٹ" : "Product",
    category:     isUr ? "کمپنی" : "Company",
    stock:        isUr ? "اسٹاک" : "Stock",
    cost:         isUr ? "لاگت" : "Cost",
    price:        isUr ? "قیمت" : "Price",
    supplier:     isUr ? "سپلائر" : "Supplier",
    actions:      isUr ? "اعمال" : "Actions",
    margin:       isUr ? "منافع" : "Margin",
  }), [isUr]);

  const filtered = useMemo(() =>
    products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (stockFilter === "low"     && !(p.currentStock > 0 && p.currentStock <= p.reorderPoint)) return false;
      if (stockFilter === "out"     && p.currentStock !== 0) return false;
      if (stockFilter === "healthy" && p.currentStock <= p.reorderPoint) return false;
      if (supplierFilter !== "all" && p.supplierId !== supplierFilter) return false;
      return true;
    }),
  [products, search, categoryFilter, stockFilter, supplierFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // ── Bulk selection ────────────────────────────────────────────────────
  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((p) => selectedIds.has(p.id));

  function toggleAll() {
    if (visibleProducts.length === 0) return;
    const idsOnPage = visibleProducts.map((p) => p.id);
    if (idsOnPage.every((id) => selectedIds.has(id))) {
      setSelectedIds((prev) => { const next = new Set(prev); for (const id of idsOnPage) next.delete(id); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); for (const id of idsOnPage) next.add(id); return next; });
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    openDeleteDialog(Array.from(selectedIds));
  }

  // Group visible products by niche for visual separation
  const groupedByNiche = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const p of visibleProducts) {
      const key = p.niche ?? "other";
      (groups[key] ??= []).push(p);
    }
    return groups;
  }, [visibleProducts]);

  function openDeleteDialog(ids: string[]) {
    const normalized = Array.from(new Set(ids.filter((id) => id.trim().length > 0)));
    if (normalized.length === 0) return;
    setFeedback(null);
    setPendingDeleteIds(normalized);
    setDeleteDialogOpen(true);
  }

  function handleConfirmDelete() {
    if (pendingDeleteIds.length === 0) return;
    setFeedback(null);
    startTransition(async () => {
      const result = (await deleteProductsForCurrentOrganization(pendingDeleteIds)) as DeleteProductsResult;
      if (result?.error) {
        const preview = Array.isArray(result.blocked) && result.blocked.length > 0
          ? ` ${lbl.blockedPfx} ${result.blocked.slice(0, 3).map((b) => b.sku).join(", ")}`
          : "";
        setFeedback({ type: "error", message: result.error + preview });
        return;
      }
      const deletedSet = new Set(pendingDeleteIds);
      setProducts((prev) => prev.filter((p) => !deletedSet.has(p.id)));
      setDeleteDialogOpen(false);
      setPendingDeleteIds([]);
      setSelectedIds((prev) => { const next = new Set(prev); for (const id of deletedSet) next.delete(id); return next; });
      setFeedback({ type: "success", message: lbl.deleted(result?.deleted ?? deletedSet.size) });
    });
  }

  function handleProductSaved(result: { id: string; isNew: boolean }) {
    window.location.reload();
    setFeedback({
      type: "success",
      message: result.isNew
        ? (isUr ? "پروڈکٹ شامل ہو گئی۔" : "Product added successfully.")
        : (isUr ? "پروڈکٹ اپڈیٹ ہو گئی۔" : "Product updated successfully."),
    });
  }

  function handleStockAdjusted(productId: string, newStock: number) {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, currentStock: newStock } : p)));
    setFeedback({ type: "success", message: isUr ? "اسٹاک ایڈجسٹ ہو گیا۔" : "Stock adjusted successfully." });
  }

  if (products.length === 0) {
    return (
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ColumnSettingsDialog initialConfigs={columnConfigs ?? {}} />
          {canEditInventory && (
            <Button variant="outline" onClick={() => setImportWizardOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Smart Import
            </Button>
          )}
          <InventoryImportControls />
          {canEditInventory && (
            <Button onClick={() => { setEditingProduct(null); setProductFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />{lbl.addProduct}
            </Button>
          )}
        </div>
        <EmptyState title={t("inventory.noProductsTitle")} description={t("inventory.noProductsDescription")} />
        <ProductFormDialog open={productFormOpen} onOpenChange={setProductFormOpen} product={editingProduct} suppliers={suppliers} onSuccess={handleProductSaved} />
      </div>
    );
  }

  const pendingDeleteProducts = products.filter((p) => new Set(pendingDeleteIds).has(p.id));

  return (
    <div className="min-w-0 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 basis-full sm:basis-64 sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder={t("inventory.searchPlaceholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full min-w-0 gap-2 whitespace-nowrap sm:w-48 sm:shrink-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-start">
            <Filter className="h-4 w-4 shrink-0" />
            <SelectValue placeholder={t("inventory.filter.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inventory.filter.allCategories")}</SelectItem>
            {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full min-w-0 gap-2 whitespace-nowrap sm:w-48 sm:shrink-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-start">
            <SelectValue placeholder={t("inventory.filter.stockLevel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inventory.filter.allLevels")}</SelectItem>
            <SelectItem value="healthy">{t("inventory.filter.healthy")}</SelectItem>
            <SelectItem value="low">{t("inventory.filter.lowStock")}</SelectItem>
            <SelectItem value="out">{t("inventory.filter.outOfStock")}</SelectItem>
          </SelectContent>
        </Select>
        {suppliers.length > 0 && (
          <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full min-w-0 gap-2 whitespace-nowrap sm:w-48 sm:shrink-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-start">
              <SelectValue placeholder={isUr ? "سپلائر" : "Supplier"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isUr ? "تمام سپلائرز" : "All Suppliers"}</SelectItem>
              {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <ColumnSettingsDialog initialConfigs={columnConfigs ?? {}} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEditInventory && (
            <Button variant="outline" onClick={() => setImportWizardOpen(true)} size="sm">
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Smart Import
            </Button>
          )}
          <InventoryImportControls />
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()); }}
            className="gap-1.5 h-8 text-xs"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {selectMode ? (isUr ? "منتخبیہ بند" : "Done") : (isUr ? "منتخب کریں" : "Select")}
          </Button>
          <span className="text-xs text-zinc-500">{filtered.length} {isUr ? "پروڈکٹس" : "products"}</span>
          {canEditInventory && (
            <Button onClick={() => { setEditingProduct(null); setProductFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />{lbl.addProduct}
            </Button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <p className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
          feedback.type === "error"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}>{feedback.message}</p>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm dark:border-blue-900/60 dark:bg-blue-950/30">
          <span className="font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} {isUr ? "منتخب" : "selected"}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs">
              {isUr ? "منتخبیہ منسوخ" : "Clear Selection"}
            </Button>
            {canDeleteInventory && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isPending} className="h-7 text-xs gap-1">
                <Trash2 className="h-3 w-3" />
                {isUr ? `منتخب حذف کریں (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* One table owns every column, including selection and configured custom fields. */}
      <div className="max-w-full overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700" role="region" aria-label={isUr ? "انوینٹری ٹیبل" : "Inventory table"} tabIndex={0}>
        <table className="w-full border-collapse text-sm" data-inventory-table>
          <thead className="bg-zinc-100 dark:bg-zinc-800">
            <tr>
              {selectMode && <th scope="col" className="w-12 px-4 py-3 text-start"><Checkbox aria-label={isUr ? "تمام پروڈکٹس منتخب کریں" : "Select all products on this page"} checked={allVisibleSelected} onCheckedChange={toggleAll} /></th>}
              {visibleColumns.map((col) => (
                <th key={col.key} scope="col" data-column={col.key} style={{ width: col.width }}
                  className={`px-4 py-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${col.key === "actions" ? "text-end" : "text-start"}`}>
                  {col.key === "category" ? (isUr ? "کمپنی" : "Company") : col.label ?? col.key}
                </th>
              ))}
            </tr>
          </thead>
          {Object.entries(groupedByNiche).map(([niche, nicheProducts]) => {
            const cfg = getNicheConfig(niche);
            const NicheIcon = cfg.icon;
            return (
              <tbody key={niche}>
                <tr className={cfg.bg}>
                  <th scope="rowgroup" colSpan={visibleColumns.length + (selectMode ? 1 : 0)} className="border-y border-zinc-200/60 px-4 py-2 text-start dark:border-zinc-700/50">
                    <span className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                      <NicheIcon className="h-3.5 w-3.5 shrink-0" />
                      {niche === "other" ? (isUr ? "عمومی" : "General") : t(`product.niche.${niche}` as Parameters<typeof t>[0])}
                      <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-700/70 dark:text-zinc-400">{nicheProducts.length}</span>
                    </span>
                  </th>
                </tr>
                {nicheProducts.map((product) => (
                  <tr key={product.id} data-product-row className={`border-b border-zinc-200/50 dark:border-zinc-700/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${selectedIds.has(product.id) ? "bg-blue-50 dark:bg-blue-950/20" : "bg-white dark:bg-zinc-900"}`}>
                    {selectMode && <td className="px-4 py-3.5 align-middle"><Checkbox aria-label={`${isUr ? "منتخب کریں" : "Select"} ${product.name}`} checked={selectedIds.has(product.id)} onCheckedChange={() => toggleOne(product.id)} /></td>}
                    {visibleColumns.map((col) => (
                      <td key={col.key} data-column={col.key} style={{ minWidth: col.key === "name" ? Math.max(col.width ?? 0, 256) : Math.max(col.width ?? 120, 96) }} className={`px-4 py-3.5 align-middle text-start ${col.key === "name" ? "" : "whitespace-nowrap"}`}>
                        {col.key === "name" ? (
                          <div className="min-w-0 space-y-1.5">
                            <p className="max-w-sm break-words font-semibold text-zinc-900 dark:text-zinc-100">{withUrduMeaning(product.name, language)}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <ExpiryBadge expiresAt={product.expiresAt} />
                              <StockPill stock={product.currentStock} reorderPoint={product.reorderPoint} t={t} />
                            </div>
                          </div>
                        ) : col.key === "actions" ? (
                      <div className="flex items-center justify-end gap-1">
                        {canEditInventory && (
                          <>
                            <button
                              onClick={() => { setEditingProduct(product); setProductFormOpen(true); }}
                              title={lbl.editProduct}
                              disabled={isPending}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-colors disabled:opacity-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span className="inline">{lbl.editProduct}</span>
                            </button>
                            <button
                              onClick={() => { setAdjustingProduct(product); setStockAdjustOpen(true); }}
                              title={lbl.adjustStock}
                              disabled={isPending}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
                            >
                              <PackagePlus className="h-3.5 w-3.5" />
                              <span className="inline">{lbl.adjustStock}</span>
                            </button>
                            <button
                              onClick={() => setQrProduct({ id: product.id, sku: product.sku, name: product.name })}
                              title={lbl.qrCode}
                              disabled={isPending}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-300 transition-colors disabled:opacity-50"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {canDeleteInventory && (
                          <button
                            onClick={() => openDeleteDialog([product.id])}
                            title={lbl.deleteOne}
                            disabled={isPending}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                        ) : col.key === "category" ? (
                          <span>{withUrduMeaning(product.category, language)}</span>
                        ) : col.key === "supplier" ? (
                          <span>{product.supplier ? withUrduMeaning(product.supplier.name, language) : "—"}</span>
                        ) : (
                          <DynamicCellValue entity={product} column={col} currencyCode={currencyCode} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-16 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("inventory.noProductsMatch")}</p>
        </div>
      )}

      {/* Pagination */}
      <TablePagination
        page={safePage}
        pageSize={pageSize}
        totalItems={filtered.length}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        labels={{ showing: lbl.showing, of: lbl.of, rowsPerPage: lbl.rowsPerPage, page: lbl.page, previous: lbl.previous, next: lbl.next }}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open && !isPending) { setDeleteDialogOpen(false); setPendingDeleteIds([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lbl.deleteTitle}</DialogTitle>
            <DialogDescription>{lbl.deleteDesc}</DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            {lbl.deleteWarn}
          </p>
          {pendingDeleteProducts.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
              {pendingDeleteProducts.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="font-mono text-zinc-400">{p.sku}</span>
                  <span>{p.name}</span>
                </div>
              ))}
              {pendingDeleteProducts.length > 8 && <p className="text-zinc-400">+{pendingDeleteProducts.length - 8} more…</p>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setPendingDeleteIds([]); }} disabled={isPending}>{lbl.cancel}</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isPending}>
              {isPending ? (isUr ? "حذف ہو رہا ہے…" : "Deleting…") : lbl.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product Dialog */}
      <ProductFormDialog open={productFormOpen} onOpenChange={setProductFormOpen} product={editingProduct} suppliers={suppliers} onSuccess={handleProductSaved} />

      {/* Stock Adjust Dialog */}
      <StockAdjustDialog open={stockAdjustOpen} onOpenChange={setStockAdjustOpen} product={adjustingProduct} onSuccess={handleStockAdjusted} />

      {/* QR Code Dialog */}
      <ProductQRDialog product={qrProduct} onClose={() => setQrProduct(null)} />

      {/* Smart Import Wizard */}
      <ImportWizard entityType="inventory" open={importWizardOpen} onOpenChange={setImportWizardOpen} />
    </div>
  );
}
