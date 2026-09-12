"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, Plus, Pencil, Trash2, Wrench, BookOpen, Download } from "lucide-react";
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
  createContractor,
  updateContractor,
  deleteContractor,
  createWorkOrder,
  createContractorPayment,
  getContractorLedger,
  type ContractorFormInput,
  type WorkOrderFormInput,
  type ContractorPaymentFormInput,
} from "@/lib/actions/contractors";
import { generateContractorLedger } from "@/lib/pdf/reports";

type Contractor = {
  id: string;
  contractorCode: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  specialty: string | null;
  status: string;
  _count: { workOrders: number; payments: number };
  payments: { amount: number }[];
};

type Stats = {
  totalContractors: number;
  activeContractors: number;
  activeWorkOrders: number;
  totalPaid: number;
};

const TABS = ["Contractors", "Work Orders", "Ledger"] as const;
const STATUSES = ["ACTIVE", "INACTIVE"];

const EMPTY_CONTRACTOR: ContractorFormInput = { name: "" };
const fmt = (n: number) => `Rs.${n.toLocaleString()}`;

export function ContractorsClient({
  initialContractors,
  stats,
  currencyCode,
  canEdit,
}: {
  initialContractors: Contractor[];
  stats: Stats;
  currencyCode: string;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<string>("Contractors");
  const [contractors, setContractors] = useState(initialContractors);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractorFormInput>(EMPTY_CONTRACTOR);
  const [woForm, setWoForm] = useState<WorkOrderFormInput>({ contractorId: "", description: "", agreedAmount: 0 });
  const [payForm, setPayForm] = useState<ContractorPaymentFormInput>({ contractorId: "", date: new Date().toISOString().split("T")[0], amount: 0, paymentMethod: "CASH" });
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setContractors(initialContractors); }, [initialContractors]);

  useEffect(() => {
    if (!formOpen) { setForm(EMPTY_CONTRACTOR); setEditingId(null); setFormError(null); }
  }, [formOpen]);

  useEffect(() => {
    if (formOpen && editingId) {
      const c = contractors.find((x) => x.id === editingId);
      if (c) setForm({
        name: c.name,
        companyName: c.companyName ?? undefined,
        phone: c.phone ?? undefined,
        email: c.email ?? undefined,
        cnic: c.cnic ?? undefined,
        specialty: c.specialty ?? undefined,
      });
    }
  }, [formOpen, editingId, contractors]);

  function handleExportLedger(contractorId: string) {
    startTransition(async () => {
      const ledger = await getContractorLedger(contractorId);
      if (!ledger) return;
      const rows: any[] = [];
      for (const wo of ledger.workOrders) {
        rows.push({
          type: "Work Order",
          date: new Date(wo.createdAt).toLocaleDateString(),
          description: wo.description,
          project: wo.project?.projectName || "",
          amount: wo.agreedAmount,
          status: wo.status,
        });
      }
      for (const p of ledger.payments) {
        rows.push({
          type: "Payment",
          date: new Date(p.date).toLocaleDateString(),
          description: p.remarks || "Payment",
          project: "",
          amount: -p.amount,
          status: p.paymentMethod,
        });
      }
      rows.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const totalAgreed = ledger.workOrders.reduce((s: number, wo: any) => s + wo.agreedAmount, 0);
      const totalPaid = ledger.payments.reduce((s: number, p: any) => s + p.amount, 0);
      await generateContractorLedger({
        contractorName: ledger.name,
        contractorCode: ledger.contractorCode,
        date: new Date().toISOString().split("T")[0],
        rows,
        totalAgreed,
        totalPaid,
        balance: totalAgreed - totalPaid,
      }).catch(() => setFeedback({ type: "error", message: "Could not generate the report. Please try again." }));
    });
  }

  function openAdd() { setEditingId(null); setFormOpen(true); }
  function openEdit(id: string) { setEditingId(id); setFormOpen(true); }
  function openDelete(id: string) { setDeletingId(id); setDeleteOpen(true); }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingId ? await updateContractor(editingId, form) : await createContractor(form);
      if (result.error) { setFormError(result.error); return; }
      setFormOpen(false);
      setFeedback({ type: "success", message: editingId ? "Contractor updated." : "Contractor added." });
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    startTransition(async () => {
      const result = await deleteContractor(deletingId);
      if (result.error) { setFeedback({ type: "error", message: result.error }); setDeleteOpen(false); return; }
      setContractors((prev) => prev.filter((c) => c.id !== deletingId));
      setDeleteOpen(false);
      setFeedback({ type: "success", message: "Contractor deleted." });
    });
  }

  function handleWoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await createWorkOrder(woForm);
      if (result.error) { setFormError(result.error); return; }
      setWoOpen(false);
      setFeedback({ type: "success", message: "Work order created." });
      window.location.reload();
    });
  }

  function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await createContractorPayment(payForm);
      if (result.error) { setFormError(result.error); return; }
      setPayOpen(false);
      setFeedback({ type: "success", message: "Payment recorded." });
      window.location.reload();
    });
  }

  const filtered = contractors.filter((c) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.contractorCode.toLowerCase().includes(s) || (c.companyName ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          feedback.type === "success"
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
        }`}>{feedback.message}</div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.totalContractors },
          { label: "Active", value: stats.activeContractors },
          { label: "Active WOs", value: stats.activeWorkOrders },
          { label: "Total Paid", value: fmt(stats.totalPaid) },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-zinc-200/60 bg-white/80 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/80">
            <p className="text-xs font-medium text-zinc-500">{m.label}</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === t ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}>{t}</button>
        ))}
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search contractors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <>
            <Button onClick={() => { setWoForm({ ...woForm, contractorId: "" }); setWoOpen(true); }} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Work Order
            </Button>
            <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Contractor</Button>
          </>
        )}
      </div>

      {/* Contractors Tab */}
      {tab === "Contractors" && (
        <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Wrench className="h-10 w-10 text-zinc-300" />
              <p className="text-sm text-zinc-500">No contractors yet. Add your first contractor.</p>
            </div>
          ) : (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Company</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Specialty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Paid</th>
                    {canEdit && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((c) => {
                    const totalPaid = c.payments.reduce((sum, p) => sum + p.amount, 0);
                    return (
                      <tr key={c.id} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3 text-sm font-mono text-zinc-600">{c.contractorCode}</td>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{c.companyName || "-"}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{c.phone || "-"}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{c.specialty || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600"
                          }`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">{fmt(totalPaid)}</td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleExportLedger(c.id)} className="p-2 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" title="Export Ledger PDF"><Download className="h-4 w-4" /></button>
                              <button onClick={() => openEdit(c.id)} className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => openDelete(c.id)} className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Work Orders Tab placeholder */}
      {tab === "Work Orders" && (
        <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Wrench className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">Use the "Work Order" button above to create work orders for contractors.</p>
          </div>
        </div>
      )}

      {/* Ledger Tab placeholder */}
      {tab === "Ledger" && (
        <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <BookOpen className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">Select a contractor to view their full ledger.</p>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Contractor" : "Add Contractor"}</DialogTitle></DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input value={form.companyName ?? ""} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>CNIC</Label>
                <Input value={form.cnic ?? ""} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Specialty</Label>
                <Input value={form.specialty ?? ""} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editingId ? "Update" : "Add Contractor"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Work Order Dialog */}
      <Dialog open={woOpen} onOpenChange={setWoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Work Order</DialogTitle></DialogHeader>
          <form onSubmit={handleWoSubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Contractor *</Label>
                <select value={woForm.contractorId} onChange={(e) => setWoForm({ ...woForm, contractorId: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" required>
                  <option value="">Select contractor</option>
                  {contractors.filter((c) => c.status === "ACTIVE").map((c) => <option key={c.id} value={c.id}>{c.name} ({c.contractorCode})</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description *</Label>
                <Input value={woForm.description} onChange={(e) => setWoForm({ ...woForm, description: e.target.value })} required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Agreed Amount (Rs.) *</Label>
                <Input type="number" min="1" value={woForm.agreedAmount} onChange={(e) => setWoForm({ ...woForm, agreedAmount: Number(e.target.value) })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={woForm.startDate ?? ""} onChange={(e) => setWoForm({ ...woForm, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={woForm.endDate ?? ""} onChange={(e) => setWoForm({ ...woForm, endDate: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWoOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Work Order"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handlePaySubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="space-y-1.5">
              <Label>Contractor *</Label>
              <select value={payForm.contractorId} onChange={(e) => setPayForm({ ...payForm, contractorId: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" required>
                <option value="">Select contractor</option>
                {contractors.filter((c) => c.status === "ACTIVE").map((c) => <option key={c.id} value={c.id}>{c.name} ({c.contractorCode})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (Rs.) *</Label>
              <Input type="number" min="1" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Input value={payForm.remarks ?? ""} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Record Payment"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Contractor</DialogTitle></DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
