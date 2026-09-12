"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Save, Search } from "lucide-react";
import { updateSelectedProductsForCurrentOrganization } from "@/lib/actions/inventory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/components/providers/i18n-provider";

interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  leadTimeDays: number;
  costPrice: number;
  sellingPrice: number;
}

interface UpdateResult {
  success?: boolean;
  updated?: number;
  error?: string;
}

function sourceRoute(source: string) {
  if (source === "forecasts") return "/forecasts";
  return "/inventory";
}

export function RecordControlsClient({
  records,
  source,
  canManage,
}: {
  records: ProductRecord[];
  source: string;
  canManage: boolean;
}) {
  const { language } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [category, setCategory] = useState("");
  const [currentStock, setCurrentStock] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [tableCategoryFilter, setTableCategoryFilter] = useState("ALL");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);

  const backHref = useMemo(() => sourceRoute(source), [source]);

  const labels =
    language === "ur"
      ? {
          applyTitle: "منتخب ریکارڈز پر اپڈیٹ لاگو کریں",
          helper: "صرف وہی فیلڈ اپڈیٹ ہوں گی جن میں آپ ویلیو درج کریں گے۔",
          category: "کیٹیگری",
          currentStock: "موجودہ اسٹاک",
          reorderPoint: "ری آرڈر پوائنٹ",
          leadTimeDays: "لیڈ ٹائم (دن)",
          costPrice: "کاسٹ پرائس",
          sellingPrice: "سیلنگ پرائس",
          apply: "اپڈیٹ لاگو کریں",
          updating: "اپڈیٹ ہو رہا ہے...",
          updated: (count: number) => `${count} ریکارڈز اپڈیٹ ہو گئے۔`,
          selectedRecords: "منتخب ریکارڈز",
          backToSource: "سورس پر واپس جائیں",
          searchSelected: "منتخب ریکارڈز میں تلاش کریں",
          allCategories: "تمام کیٹیگریز",
          showing: "دکھایا جا رہا ہے",
          of: "میں سے",
          rowsPerPage: "قطاریں",
          page: "صفحہ",
          previous: "پچھلا",
          next: "اگلا",
          noMatches: "کوئی منتخب ریکارڈ فلٹر کے مطابق نہیں ملا۔",
          noManagePermission: "آپ کو ریکارڈ اپڈیٹ کرنے کی اجازت نہیں ہے۔",
        }
      : {
          applyTitle: "Apply updates to selected records",
          helper: "Only fields with values will be updated.",
          category: "Category",
          currentStock: "Current Stock",
          reorderPoint: "Reorder Point",
          leadTimeDays: "Lead Time (Days)",
          costPrice: "Cost Price",
          sellingPrice: "Selling Price",
          apply: "Apply Updates",
          updating: "Updating...",
          updated: (count: number) => `${count} record(s) updated.`,
          selectedRecords: "Selected Records",
          backToSource: "Back to source page",
          searchSelected: "Search selected records",
          allCategories: "All Categories",
          showing: "Showing",
          of: "of",
          rowsPerPage: "Rows",
          page: "Page",
          previous: "Previous",
          next: "Next",
          noMatches: "No selected records match your filters.",
          noManagePermission: "You do not have permission to update records.",
        };

  const categoryOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.category))).sort((left, right) => left.localeCompare(right)),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = tableSearch.trim().toLowerCase();

    return records.filter((record) => {
      const searchMatch =
        normalizedSearch.length === 0 ||
        record.sku.toLowerCase().includes(normalizedSearch) ||
        record.name.toLowerCase().includes(normalizedSearch);

      const categoryMatch = tableCategoryFilter === "ALL" || record.category === tableCategoryFilter;

      return searchMatch && categoryMatch;
    });
  }, [records, tableSearch, tableCategoryFilter]);

  const tableTotalPages = Math.max(1, Math.ceil(filteredRecords.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, tableTotalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safeTablePage - 1) * tablePageSize;
    return filteredRecords.slice(start, start + tablePageSize);
  }, [filteredRecords, safeTablePage, tablePageSize]);

  function parseOptionalNumber(value: string) {
    if (value.trim().length === 0) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function handleApply() {
    setFeedback(null);

    const updates = {
      category: category.trim() || undefined,
      currentStock: parseOptionalNumber(currentStock),
      reorderPoint: parseOptionalNumber(reorderPoint),
      leadTimeDays: parseOptionalNumber(leadTimeDays),
      costPrice: parseOptionalNumber(costPrice),
      sellingPrice: parseOptionalNumber(sellingPrice),
    };

    startTransition(async () => {
      const result = (await updateSelectedProductsForCurrentOrganization({
        productIds: records.map((item) => item.id),
        updates,
      })) as UpdateResult;

      if (result?.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      setFeedback({
        type: "success",
        message: labels.updated(result?.updated ?? records.length),
      });
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.applyTitle}</CardTitle>
          <p className="text-sm text-zinc-500">{labels.helper}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>{labels.category}</Label>
              <Input value={category} onChange={(event) => setCategory(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{labels.currentStock}</Label>
              <Input type="number" min={0} value={currentStock} onChange={(event) => setCurrentStock(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{labels.reorderPoint}</Label>
              <Input type="number" min={0} value={reorderPoint} onChange={(event) => setReorderPoint(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{labels.leadTimeDays}</Label>
              <Input type="number" min={1} value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{labels.costPrice}</Label>
              <Input type="number" min={0} step={0.01} value={costPrice} onChange={(event) => setCostPrice(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{labels.sellingPrice}</Label>
              <Input type="number" min={0} step={0.01} value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} />
            </div>
          </div>

          {feedback && (
            <p
              className={`rounded-md border p-3 text-sm ${
                feedback.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {feedback.message}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" asChild>
              <Link href={backHref}>{labels.backToSource}</Link>
            </Button>
            {canManage ? (
              <Button onClick={handleApply} disabled={isPending}>
                <Save className="h-4 w-4" />
                {isPending ? labels.updating : labels.apply}
              </Button>
            ) : (
              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                {labels.noManagePermission}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.selectedRecords}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={tableSearch}
                onChange={(event) => {
                  setTableSearch(event.target.value);
                  setTablePage(1);
                }}
                placeholder={labels.searchSelected}
                className="pl-9"
              />
            </div>

            <Select
              value={tableCategoryFilter}
              onValueChange={(value) => {
                setTableCategoryFilter(value);
                setTablePage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={labels.allCategories} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{labels.allCategories}</SelectItem>
                {categoryOptions.map((categoryItem) => (
                  <SelectItem key={categoryItem} value={categoryItem}>
                    {categoryItem}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-xs">{record.sku}</TableCell>
                  <TableCell className="font-medium">{record.name}</TableCell>
                  <TableCell>{record.category}</TableCell>
                  <TableCell className="text-right">{record.currentStock}</TableCell>
                  <TableCell className="text-right">{record.reorderPoint}</TableCell>
                  <TableCell className="text-right">{record.leadTimeDays}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            page={safeTablePage}
            pageSize={tablePageSize}
            totalItems={filteredRecords.length}
            totalPages={tableTotalPages}
            onPageChange={setTablePage}
            onPageSizeChange={(size) => {
              setTablePageSize(size);
              setTablePage(1);
            }}
            labels={{
              showing: labels.showing,
              of: labels.of,
              rowsPerPage: labels.rowsPerPage,
              page: labels.page,
              previous: labels.previous,
              next: labels.next,
            }}
          />

          {filteredRecords.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{labels.noMatches}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
