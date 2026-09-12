"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Plus, Edit3, Trash2, Search, Users, Mail, Phone, MapPin, Upload, CheckSquare } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";
import {
  createCustomerForCurrentOrganization,
  updateCustomerForCurrentOrganization,
  deleteCustomerForCurrentOrganization,
  deleteCustomersForCurrentOrganization,
  type CustomerRow,
  type CustomerFormInput,
} from "@/lib/actions/customers";
import { ImportWizard } from "@/components/import/import-wizard";
import { ColumnSettingsDialog } from "@/components/column-config/column-settings-dialog";
import { DynamicCellValue } from "@/components/column-config/dynamic-column-renderer";
import { resolveColumnConfig, getVisibleColumns } from "@/lib/column-config/resolver";
import type { OrgColumnConfigs } from "@/lib/column-config/types";

const EMPTY_FORM: CustomerFormInput = {
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  creditLimit: 0,
  paymentTerms: 30,
};

export function CustomersClient({
  initialCustomers,
  currencyCode,
  canEdit,
  columnConfigs,
}: {
  initialCustomers: CustomerRow[];
  currencyCode: string;
  canEdit: boolean;
  columnConfigs?: OrgColumnConfigs;
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  // ── Column configuration ───────────────────────────────────────────
  const entityConfig = useMemo(() => resolveColumnConfig("customers", columnConfigs), [columnConfigs]);
  const visibleColumns = useMemo(() => getVisibleColumns(entityConfig), [entityConfig]);

  useEffect(() => {
    if (formOpen) {
      setFormError(null);
      const editing = editingId ? customers.find((c) => c.id === editingId) : null;
      setForm(
        editing
          ? {
              name: editing.name,
              code: editing.code,
              email: editing.email ?? "",
              phone: editing.phone ?? "",
              address: editing.address ?? "",
              notes: editing.notes ?? "",
              creditLimit: editing.creditLimit,
              paymentTerms: editing.paymentTerms,
            }
          : EMPTY_FORM
      );
    }
  }, [formOpen, editingId, customers]);

  const filtered = customers.filter(
    (c) =>
      !search.trim() ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.address ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ── Bulk selection ──────────────────────────────────────────────────
  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  function toggleAll() {
    if (filtered.length === 0) return;
    const idsOnPage = filtered.map((c) => c.id);
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
      const result = await deleteCustomersForCurrentOrganization(Array.from(selectedIds));
      setBulkDeleteOpen(false);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        const deletedSet = new Set(Array.from(selectedIds));
        setCustomers((prev) => prev.filter((c) => !deletedSet.has(c.id)));
        setSelectedIds(new Set());
        setFeedback({ type: "success", message: `${result.deleted ?? deletedSet.size} customer(s) deleted.` });
      }
    });
  }

  function openAdd() { setEditingId(null); setFormOpen(true); }
  function openEdit(id: string) { setEditingId(id); setFormOpen(true); }
  function openDelete(id: string) { setDeletingId(id); setDeleteOpen(true); }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateCustomerForCurrentOrganization(editingId, form)
        : await createCustomerForCurrentOrganization(form);
      if (result.error) { setFormError(result.error); return; }
      setFormOpen(false);
      setFeedback({
        type: "success",
        message: editingId ? "Customer updated." : "Customer added.",
      });
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    startTransition(async () => {
      const result = await deleteCustomerForCurrentOrganization(deletingId);
      setDeleteOpen(false);
      if (result.error) {
        setFeedback({ type: "error", message: result.error });
      } else {
        setCustomers((prev) => prev.filter((c) => c.id !== deletingId));
        setDeletingId(null);
        setFeedback({ type: "success", message: "Customer deleted." });
      }
    });
  }

  const deletingCustomer = customers.find((c) => c.id === deletingId);

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"}`}>
          {feedback.message}
          <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <ColumnSettingsDialog initialConfigs={columnConfigs ?? {}} />
        {canEdit && (
          <Button variant="outline" onClick={() => setImportWizardOpen(true)} size="sm" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
        )}
        {canEdit && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Add Customer
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

      <div className="text-sm text-zinc-500">{filtered.length} customer{filtered.length !== 1 ? "s" : ""}</div>

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

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Users className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">No customers yet. Add your first customer.</p>
          </div>
        ) : (
          <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map((c) => (
              <div key={c.id} className={`p-4 space-y-2 ${selectedIds.has(c.id) ? "bg-blue-50/60 dark:bg-blue-950/10" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {selectMode && (
                      <div className="pt-0.5">
                        <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                      </div>
                    )}
                    <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{c.code} · {c.name}</p>
                    {c.address && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </p>
                    )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => openEdit(c.id)} aria-label="Edit" className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => openDelete(c.id)} aria-label="Delete" className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {(c.email || c.phone) && (
                  <div className="space-y-0.5">
                    {c.email && <p className="flex items-center gap-1 text-xs text-zinc-500"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{c.email}</span></p>}
                    {c.phone && <p className="flex items-center gap-1 text-xs text-zinc-500"><Phone className="h-3 w-3 shrink-0" />{c.phone}</p>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-zinc-100 dark:border-zinc-800 pt-2 text-xs">
                  <div><span className="text-zinc-400">Orders: </span><span className="font-medium text-zinc-700 dark:text-zinc-300">{c.orderCount}</span></div>
                  <div className="text-right"><span className="text-zinc-400">Spent: </span><span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(c.totalSpent, currencyCode)}</span></div>
                  <div><span className="text-zinc-400">Credit: </span>{c.creditLimit > 0 ? formatCurrency(c.creditLimit, currencyCode) : "—"}</div>
                  <div className="text-right"><span className="text-zinc-400">Terms: </span>Net {c.paymentTerms}d</div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                {selectMode && (
                  <th className="w-10 px-3 py-3">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-semibold text-zinc-500 uppercase text-xs tracking-wide ${
                      col.key === "actions" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label ?? col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((c) => (
                <tr key={c.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${selectedIds.has(c.id) ? "bg-blue-50/60 dark:bg-blue-950/10" : ""}`}>
                  {selectMode && (
                    <td className="w-10 px-3 py-3">
                      <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.key === "actions" ? "text-right" : ""}`}>
                      {col.key === "actions" ? (
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <>
                              <button onClick={() => openEdit(c.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button onClick={() => openDelete(c.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      ) : col.key === "name" ? (
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.code} · {c.name}</p>

                        </div>
                      ) : col.key === "email" || col.key === "phone" ? (
                        <div className="space-y-0.5">
                          {col.key === "email" && c.email && <p className="flex items-center gap-1 text-zinc-500 text-xs"><Mail className="h-3 w-3" />{c.email}</p>}
                          {col.key === "phone" && c.phone && <p className="flex items-center gap-1 text-zinc-500 text-xs"><Phone className="h-3 w-3" />{c.phone}</p>}
                          {((col.key === "email" && !c.email) || (col.key === "phone" && !c.phone)) && <span className="text-sm text-zinc-300 dark:text-zinc-600">—</span>}
                        </div>
                      ) : (
                        <DynamicCellValue entity={c} column={col} currencyCode={currencyCode} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>Customer details for your sales records.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 mt-2">
            {formError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5"><Label>Customer code</Label><Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Defaults to customer ID" /></div>
              <div className="col-span-2 space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer or business name" required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 000 0000" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City, Country" />
              </div>
              <div className="space-y-1.5">
                <Label>Credit Limit</Label>
                <Input type="number" min={0} step={0.01} value={form.creditLimit ?? 0} onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Terms (days)</Label>
                <Input type="number" min={0} step={1} value={form.paymentTerms ?? 30} onChange={(e) => setForm({ ...form, paymentTerms: parseInt(e.target.value) || 30 })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editingId ? "Update" : "Add Customer"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Remove <strong>{deletingCustomer?.name}</strong>? Their sales history will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customers</DialogTitle>
            <DialogDescription>
              Move <strong>{selectedIds.size}</strong> customer(s) to the recycle bin? Their sales history will be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending}>{isPending ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Smart Import Wizard */}
      <ImportWizard entityType="customers" open={importWizardOpen} onOpenChange={setImportWizardOpen} />
    </div>
  );
}
