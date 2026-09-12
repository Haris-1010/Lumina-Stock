"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, Plus, Pencil, Trash2, Briefcase, Eye, ArrowLeftRight, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  createCompanyAsset,
  updateCompanyAsset,
  deleteCompanyAsset,
  recordAssetMovement,
  type CompanyAssetFormInput,
} from "@/lib/actions/company-assets";
import { getAssetExportData } from "@/lib/actions/exports";
import { generateAssetRegister } from "@/lib/pdf/reports";
import { exportToExcel } from "@/lib/excel/exports";

type Asset = {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  department: string;
  condition: string;
  status: string;
  purchasePrice: number;
  quantity: number;
  assignedTo: string | null;
  supplier: string | null;
  _count: { movements: number };
};

type Metrics = {
  totalAssets: number;
  available: number;
  issued: number;
  inRepair: number;
  totalValue: number;
};

const EMPTY_FORM: CompanyAssetFormInput = {
  assetName: "",
  category: "OFFICE",
  purchasePrice: 0,
  quantity: 1,
  department: "OFFICE",
  condition: "NEW",
};

const CATEGORIES = ["OFFICE", "ELECTRICAL", "CONSTRUCTION", "VEHICLE"];
const DEPARTMENTS = ["OFFICE", "SITE", "STORE"];
const CONDITIONS = ["NEW", "GOOD", "REPAIR", "SCRAP"];
const STATUS_TABS = ["ALL", "AVAILABLE", "ISSUED", "IN_REPAIR", "SCRAPPED"] as const;

const fmt = (n: number) => `Rs.${n.toLocaleString()}`;

export function CompanyAssetsClient({
  initialAssets,
  metrics,
  currencyCode,
  organizationId,
  canEdit,
}: {
  initialAssets: Asset[];
  metrics: Metrics;
  currencyCode: string;
  organizationId: string;
  canEdit: boolean;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movementAssetId, setMovementAssetId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyAssetFormInput>(EMPTY_FORM);
  const [movementForm, setMovementForm] = useState({ movementType: "ISSUE", toDept: "", toPerson: "", notes: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  useEffect(() => {
    if (!formOpen) {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setFormError(null);
    }
  }, [formOpen]);

  useEffect(() => {
    if (formOpen && editingId) {
      const asset = assets.find((a) => a.id === editingId);
      if (asset) {
        setForm({
          assetName: asset.assetName,
          category: asset.category,
          purchasePrice: asset.purchasePrice,
          quantity: asset.quantity,
          department: asset.department,
          condition: asset.condition,
          supplier: asset.supplier ?? undefined,
        });
      }
    }
  }, [formOpen, editingId, assets]);

  function handleExportPdf() {
    startTransition(async () => {
      const exportData = await getAssetExportData(organizationId);
      const data = {
        date: new Date().toISOString().split("T")[0],
        assets: exportData.map((a: any) => ({
          assetCode: a["Asset Code"],
          assetName: a["Asset Name"],
          category: a["Category"],
          department: a["Department"],
          condition: a["Condition"],
          status: a["Status"],
          purchasePrice: a["Purchase Price"],
          assignedTo: a["Assigned To"] || undefined,
        })),
      };
      await generateAssetRegister(data).catch(() => setFeedback({ type: "error", message: "Could not generate the report. Please try again." }));
    });
  }

  function handleExportExcel() {
    startTransition(async () => {
      const data = await getAssetExportData(organizationId);
      exportToExcel(data, `Asset-Register-${new Date().toISOString().split("T")[0]}`);
    });
  }

  function openAdd() { setEditingId(null); setFormOpen(true); }
  function openEdit(id: string) { setEditingId(id); setFormOpen(true); }
  function openDelete(id: string) { setDeletingId(id); setDeleteOpen(true); }
  function openMovement(id: string) { setMovementAssetId(id); setMovementOpen(true); }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateCompanyAsset(editingId, form)
        : await createCompanyAsset(form);
      if (result.error) { setFormError(result.error); return; }
      setFormOpen(false);
      setFeedback({ type: "success", message: editingId ? "Asset updated." : "Asset added." });
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    startTransition(async () => {
      const result = await deleteCompanyAsset(deletingId);
      if (result.error) { setFeedback({ type: "error", message: result.error }); setDeleteOpen(false); return; }
      setAssets((prev) => prev.filter((a) => a.id !== deletingId));
      setDeleteOpen(false);
      setFeedback({ type: "success", message: "Asset deleted." });
    });
  }

  function handleMovementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!movementAssetId) return;
    setFormError(null);
    startTransition(async () => {
      const result = await recordAssetMovement({
        assetId: movementAssetId,
        movementType: movementForm.movementType,
        toDept: movementForm.toDept || undefined,
        toPerson: movementForm.toPerson || undefined,
        notes: movementForm.notes || undefined,
      });
      if (result.error) { setFormError(result.error); return; }
      setMovementOpen(false);
      setFeedback({ type: "success", message: "Asset movement recorded." });
      window.location.reload();
    });
  }

  const filtered = assets.filter((a) => {
    const matchesSearch = !search.trim() ||
      a.assetName.toLowerCase().includes(search.toLowerCase()) ||
      a.assetCode.toLowerCase().includes(search.toLowerCase()) ||
      (a.assignedTo ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusTab === "ALL" || a.status === statusTab;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Assets", value: metrics.totalAssets, icon: Briefcase },
          { label: "Available", value: metrics.available, icon: Briefcase },
          { label: "Issued", value: metrics.issued, icon: Briefcase },
          { label: "Total Value", value: fmt(metrics.totalValue), icon: Briefcase },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-zinc-200/60 bg-white/80 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/80">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{m.label}</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusTab === tab
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canEdit && (
          <>
            <Button onClick={handleExportPdf} variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Export PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" /> Add Asset
            </Button>
          </>
        )}
      </div>

      <p className="text-sm text-zinc-500">{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</p>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Briefcase className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">No assets found. Add your first asset.</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Dept</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Condition</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Value</th>
                    {canEdit && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-zinc-600 dark:text-zinc-400">{a.assetCode}</td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{a.assetName}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{a.category}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{a.department}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{a.condition}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" :
                          a.status === "ISSUED" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" :
                          a.status === "IN_REPAIR" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                          "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>
                          {a.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-900 dark:text-zinc-100">{fmt(a.purchasePrice)}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openMovement(a.id)} className="p-2 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" title="Move">
                              <ArrowLeftRight className="h-4 w-4" />
                            </button>
                            <button onClick={() => openEdit(a.id)} className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => openDelete(a.id)} className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((a) => (
                <div key={a.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{a.assetName}</p>
                      <p className="text-xs text-zinc-500">{a.assetCode} · {a.category}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700" :
                      a.status === "ISSUED" ? "bg-blue-50 text-blue-700" :
                      a.status === "IN_REPAIR" ? "bg-amber-50 text-amber-700" :
                      "bg-zinc-100 text-zinc-600"
                    }`}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Dept: {a.department} · Condition: {a.condition}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fmt(a.purchasePrice)}</p>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => openMovement(a.id)} className="p-2 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50"><ArrowLeftRight className="h-4 w-4" /></button>
                      <button onClick={() => openEdit(a.id)} className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => openDelete(a.id)} className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Asset" : "Add Asset"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-3">
            {formError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Asset Name *</Label>
                <Input value={form.assetName} onChange={(e) => setForm({ ...form, assetName: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Price (Rs.)</Label>
                <Input type="number" min="0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Date</Label>
                <Input type="date" value={form.purchaseDate ?? ""} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Supplier</Label>
                <Input value={form.supplier ?? ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Assigned To</Label>
                <Input value={form.assignedTo ?? ""} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editingId ? "Update" : "Add Asset"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Asset Movement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovementSubmit} className="space-y-3">
            {formError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>
            )}
            <div className="space-y-1.5">
              <Label>Movement Type *</Label>
              <select value={movementForm.movementType} onChange={(e) => setMovementForm({ ...movementForm, movementType: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="ISSUE">Issue</option>
                <option value="RETURN">Return</option>
                <option value="TRANSFER">Transfer</option>
                <option value="REPAIR">Send to Repair</option>
                <option value="SCRAP">Scrap</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>To Department</Label>
              <select value={movementForm.toDept} onChange={(e) => setMovementForm({ ...movementForm, toDept: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="">Same</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>To Person</Label>
              <Input value={movementForm.toPerson} onChange={(e) => setMovementForm({ ...movementForm, toPerson: e.target.value })} placeholder="Name of person receiving" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMovementOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Record Movement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete this asset? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
