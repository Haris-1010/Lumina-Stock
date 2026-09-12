"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Edit3, Trash2, Building2, Search, Phone, Mail, Package, FileText, Upload, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createSupplierForCurrentOrganization,
  updateSupplierForCurrentOrganization,
  deleteSupplierForCurrentOrganization,
  deleteSuppliersForCurrentOrganization,
  type SupplierFormInput,
} from "@/lib/actions/suppliers";
import { ImportWizard } from "@/components/import/import-wizard";
import { ColumnSettingsDialog } from "@/components/column-config/column-settings-dialog";
import { DynamicCellValue } from "@/components/column-config/dynamic-column-renderer";
import { resolveColumnConfig, getVisibleColumns, getResponsiveGridTemplate } from "@/lib/column-config/resolver";
import type { OrgColumnConfigs } from "@/lib/column-config/types";

interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  _count: { products: number; purchaseOrders: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
}

const EMPTY_FORM: SupplierFormInput = { name: "", contact: "", email: "" };

export function SuppliersClient({
  initialSuppliers,
  canEdit,
  columnConfigs,
}: {
  initialSuppliers: Supplier[];
  canEdit: boolean;
  columnConfigs?: OrgColumnConfigs;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormInput>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  // ── Column configuration ───────────────────────────────────────────
  const entityConfig = useMemo(() => resolveColumnConfig("suppliers", columnConfigs), [columnConfigs]);
  const visibleColumns = useMemo(() => getVisibleColumns(entityConfig), [entityConfig]);

  useEffect(() => {
    if (formOpen) {
      setFormError(null);
      setForm(
        editingSupplier
          ? { name: editingSupplier.name, contact: editingSupplier.contact || "", email: editingSupplier.email || "" }
          : EMPTY_FORM
      );
    }
  }, [formOpen, editingSupplier]);

  const filtered = suppliers.filter((s) =>
    !query.trim() ||
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(query.toLowerCase()) ||
    (s.contact || "").toLowerCase().includes(query.toLowerCase())
  );

  // ── Bulk selection ──────────────────────────────────────────────────
  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  function toggleAll() {
    if (filtered.length === 0) return;
    const idsOnPage = filtered.map((s) => s.id);
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
    startTransition(async () => {
      const result = await deleteSuppliersForCurrentOrganization(Array.from(selectedIds));
      setBulkDeleteOpen(false);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        const deletedSet = new Set(Array.from(selectedIds));
        setSuppliers((prev) => prev.filter((s) => !deletedSet.has(s.id)));
        setSelectedIds(new Set());
        setFeedback({ type: "success", message: `${result.deleted ?? deletedSet.size} supplier(s) deleted.` });
      }
    });
  }

  function openAdd() { setEditingSupplier(null); setFormOpen(true); }
  function openEdit(s: Supplier) { setEditingSupplier(s); setFormOpen(true); }
  function openDelete(s: Supplier) { setDeletingSupplier(s); setDeleteOpen(true); }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingSupplier
        ? await updateSupplierForCurrentOrganization(editingSupplier.id, form)
        : await createSupplierForCurrentOrganization(form);
      if (result.error) { setFormError(result.error); return; }
      setFormOpen(false);
      setFeedback({ type: "success", message: editingSupplier ? "Supplier updated." : "Supplier added." });
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deletingSupplier) return;
    startTransition(async () => {
      const result = await deleteSupplierForCurrentOrganization(deletingSupplier.id);
      if (result.error) {
        setDeleteOpen(false);
        setFeedback({ type: "error", message: result.error });
        return;
      }
      setSuppliers((prev) => prev.filter((s) => s.id !== deletingSupplier.id));
      setDeleteOpen(false);
      setDeletingSupplier(null);
      setFeedback({ type: "success", message: "Supplier deleted." });
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search suppliers…"
            className="pl-9 rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 h-9 text-sm"
          />
        </div>
        <ColumnSettingsDialog initialConfigs={columnConfigs ?? {}} />
        {canEdit && (
          <Button variant="outline" onClick={() => setImportWizardOpen(true)} size="sm" className="gap-1.5 h-9">
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
        )}
        {canEdit && (
          <Button
            onClick={openAdd}
            className="rounded-xl h-9 px-4 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200/50 dark:shadow-none gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        )}
        <Button
          variant={selectMode ? "default" : "outline"}
          size="sm"
          onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()); }}
          className="gap-1.5 h-9 text-xs"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {selectMode ? "Done" : "Select"}
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm dark:border-blue-900/60 dark:bg-blue-950/30">
          <span className="font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs">
              Clear Selection
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={isPending} className="h-7 text-xs gap-1">
              <Trash2 className="h-3 w-3" />
              Delete Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* ── Feedback ─────────────────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
          feedback.type === "error"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}>
          {feedback.message}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <Building2 className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">No suppliers yet</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center max-w-xs">
            Add suppliers to link them to products and auto-generate purchase orders when stock runs low.
          </p>
          {canEdit && (
            <Button onClick={openAdd} variant="outline" className="rounded-xl mt-1 text-sm h-8">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add First Supplier
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Suppliers
            </span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              {filtered.length}{filtered.length !== suppliers.length ? ` / ${suppliers.length}` : ""}
            </span>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">No suppliers match your search.</div>
            ) : (
              filtered.map((supplier) => (
                <div key={supplier.id} className={`p-4 space-y-2 ${selectedIds.has(supplier.id) ? "bg-blue-50/60 dark:bg-blue-950/10" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="pt-1">
                        <Checkbox checked={selectedIds.has(supplier.id)} onCheckedChange={() => toggleOne(supplier.id)} />
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                        <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{supplier.name}</span>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => openEdit(supplier)} disabled={isPending} aria-label="Edit" className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => openDelete(supplier)} disabled={isPending} aria-label="Delete" className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {(supplier.contact || supplier.email) && (
                    <div className="space-y-0.5 text-xs">
                      {supplier.contact && <p className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"><Phone className="h-3.5 w-3.5 shrink-0" />{supplier.contact}</p>}
                      {supplier.email && <p className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{supplier.email}</span></p>}
                    </div>
                  )}
                  <div className="flex items-center gap-4 border-t border-zinc-100 dark:border-zinc-800 pt-2 text-xs">
                    <Link href={`/inventory?supplier=${supplier.id}`} className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                      <Package className="h-3.5 w-3.5 text-zinc-400" />{supplier._count.products} products
                    </Link>
                    <Link href={`/purchase-orders?supplier=${supplier.id}`} className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                      <FileText className="h-3.5 w-3.5 text-zinc-400" />{supplier._count.purchaseOrders} POs
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[780px]">
          {/* Column headers — dynamic */}
          <div
            className="grid items-center px-5 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20"
            style={{ gridTemplateColumns: `40px ${getResponsiveGridTemplate(visibleColumns)}` }}
          >
            <div className="flex items-center">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
            </div>
            {visibleColumns.map((col) => (
              <span
                key={col.key}
                className={`text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${
                  col.key === "actions" ? "text-right" : col.key === "productCount" || col.key === "poCount" ? "text-center" : ""
                }`}
              >
                {col.label ?? col.key}
              </span>
            ))}
          </div>

          {/* Rows — dynamic */}
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No suppliers match your search.
            </div>
          ) : (
            filtered.map((supplier) => (
              <div
                key={supplier.id}
                className={`group grid items-center px-5 py-3.5 border-b border-zinc-100/60 dark:border-zinc-800/40 last:border-0 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${selectedIds.has(supplier.id) ? "bg-blue-50/60 dark:bg-blue-950/10" : ""}`}
                style={{ gridTemplateColumns: `40px ${getResponsiveGridTemplate(visibleColumns)}` }}
              >
                <div className="flex items-center">
                  <Checkbox checked={selectedIds.has(supplier.id)} onCheckedChange={() => toggleOne(supplier.id)} />
                </div>
                {visibleColumns.map((col) => {
                  if (col.key === "name") {
                    return (
                      <div key={col.key} className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                          <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {supplier.name}
                        </span>
                      </div>
                    );
                  }
                  if (col.key === "contact") {
                    return (
                      <div key={col.key} className="flex items-center gap-1.5 min-w-0">
                        {supplier.contact ? (
                          <>
                            <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{supplier.contact}</span>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </div>
                    );
                  }
                  if (col.key === "email") {
                    return (
                      <div key={col.key} className="flex items-center gap-1.5 min-w-0">
                        {supplier.email ? (
                          <>
                            <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{supplier.email}</span>
                          </>
                        ) : (
                          <span className="text-sm text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </div>
                    );
                  }
                  if (col.key === "productCount") {
                    return (
                      <div key={col.key} className="flex items-center justify-center">
                        <Link
                          href={`/inventory?supplier=${supplier.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors group"
                        >
                          <Package className="h-3.5 w-3.5 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                          {supplier._count.products}
                        </Link>
                      </div>
                    );
                  }
                  if (col.key === "poCount") {
                    return (
                      <div key={col.key} className="flex items-center justify-center">
                        <Link
                          href={`/purchase-orders?supplier=${supplier.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors group"
                        >
                          <FileText className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                          {supplier._count.purchaseOrders}
                        </Link>
                      </div>
                    );
                  }
                  if (col.key === "actions") {
                    return (
                      <div key={col.key} className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEdit(supplier)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-40"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => openDelete(supplier)}
                              disabled={isPending}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    );
                  }
                  // All other columns (custom + computed) — use DynamicCellValue
                  return (
                    <div key={col.key} className="px-1">
                      <DynamicCellValue entity={supplier} column={col} />
                    </div>
                  );
                })}
              </div>
            ))
          )}
          </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? "Update supplier details." : "Add a new supplier to your organisation."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {formError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="sup-name">Supplier Name *</Label>
              <Input id="sup-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Wholesale" required className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-contact">Contact Person</Label>
              <Input id="sup-contact" value={form.contact || ""} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} placeholder="e.g. Ali Hassan" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-email">Email</Label>
              <Input id="sup-email" type="email" value={form.email || ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="e.g. orders@supplier.com" className="rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isPending} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isPending} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                {isPending ? "Saving…" : editingSupplier ? "Save Changes" : "Add Supplier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ──────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Move <strong>{deletingSupplier?.name}</strong> to the recycle bin? Products linked to this supplier will retain their link.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending} className="rounded-xl">
              {isPending ? "Moving…" : "Move to Bin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Suppliers</DialogTitle>
            <DialogDescription>
              Move <strong>{selectedIds.size}</strong> supplier(s) to the recycle bin? Products linked to them will retain their link.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isPending} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending} className="rounded-xl">
              {isPending ? "Moving…" : "Move to Bin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Import Wizard */}
      <ImportWizard entityType="suppliers" open={importWizardOpen} onOpenChange={setImportWizardOpen} />
    </div>
  );
}
