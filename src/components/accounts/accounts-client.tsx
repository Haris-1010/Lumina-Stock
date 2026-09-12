"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, Plus, Pencil, Trash2, Wallet, FileText, BookOpen, Download, Settings2 } from "lucide-react";
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
  createPettyCashSession,
  createExpense,
  updateExpense,
  deleteExpense,
  type PettyCashSessionInput,
  type ExpenseFormInput,
} from "@/lib/actions/accounts";
import { generateDailyCashReport } from "@/lib/pdf/reports";
import { exportToExcel } from "@/lib/excel/exports";
import { ExportOptionsDialog, EXPENSE_COLUMNS, loadExportOptions, type ExportOptions } from "./export-options-dialog";

type Expense = {
  id: string;
  voucherNo: string;
  date: Date | string;
  category: string;
  description: string;
  paidTo: string | null;
  amount: number;
  paymentMethod: string;
  remarks: string | null;
  project: { projectName: string } | null;
  pettyCash: { id: string; voucherNo: string } | null;
};

type PettyCashSession = {
  id: string;
  voucherNo: string;
  date: Date | string;
  receivedFrom: string | null;
  openingCash: number;
  remarks: string | null;
  totalExpenses: number;
  remaining: number;
  _count: { expenses: number };
};

type CashSummary = {
  balance: number;
  totalOpening: number;
  totalExpenses: number;
};

const CATEGORIES = [
  "MATERIAL_PURCHASE",
  "LABOUR_PAYMENT",
  "CONTRACTOR_PAYMENT",
  "TRANSPORT",
  "FUEL",
  "OFFICE_EXPENSE",
  "MISCELLANEOUS",
];

const TABS = ["Petty Cash", "All Expenses", "Cash Book", "Bank Book"] as const;

const fmt = (n: number) => `Rs.${n.toLocaleString()}`;

export function AccountsClient({
  initialExpenses,
  initialPettyCashSessions,
  todayCash,
  monthlyExpenses,
  currencyCode,
  organizationId,
  canEdit,
}: {
  initialExpenses: Expense[];
  initialPettyCashSessions: PettyCashSession[];
  todayCash: CashSummary;
  monthlyExpenses: number;
  currencyCode: string;
  organizationId: string;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<string>("Petty Cash");
  const [expenses, setExpenses] = useState(initialExpenses);
  const [sessions, setSessions] = useState(initialPettyCashSessions);
  const [search, setSearch] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pcForm, setPcForm] = useState<PettyCashSessionInput>({ date: new Date().toISOString().split("T")[0], receivedFrom: "", openingCash: 0 });
  const [expForm, setExpForm] = useState<ExpenseFormInput>({
    date: new Date().toISOString().split("T")[0],
    category: "MATERIAL_PURCHASE",
    description: "",
    amount: 0,
    paymentMethod: "CASH",
    pettyCashId: undefined,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pettyCashDialogOpen, setPettyCashDialogOpen] = useState(false);

  useEffect(() => {
    setExpenses(initialExpenses);
    setSessions(initialPettyCashSessions);
  }, [initialExpenses, initialPettyCashSessions]);

  useEffect(() => {
    if (!expenseOpen) {
      setExpForm({
        date: new Date().toISOString().split("T")[0],
        category: "MATERIAL_PURCHASE",
        description: "",
        amount: 0,
        paymentMethod: "CASH",
        pettyCashId: undefined,
      });
      setEditingId(null);
      setFormError(null);
    }
  }, [expenseOpen]);

  useEffect(() => {
    if (expenseOpen && editingId) {
      const exp = expenses.find((e) => e.id === editingId);
      if (exp) {
        const dateStr = typeof exp.date === "string" ? exp.date.split("T")[0] : exp.date.toISOString().split("T")[0];
        setExpForm({
          date: dateStr,
          category: exp.category,
          description: exp.description,
          paidTo: exp.paidTo ?? undefined,
          amount: exp.amount,
          paymentMethod: exp.paymentMethod,
          remarks: exp.remarks ?? undefined,
          pettyCashId: exp.pettyCash?.id,
        });
      }
    }
  }, [expenseOpen, editingId, expenses]);

  function formatDate(dateStr: string, fmt: ExportOptions["dateFormat"]): string {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    switch (fmt) {
      case "DD/MM/YYYY": return `${dd}/${mm}/${yyyy}`;
      case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
      case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
      default: return `${dd}/${mm}/${yyyy}`;
    }
  }

  function buildFilteredExpenses(opts: ExportOptions) {
    const sorted = [...expenses].sort((a, b) => {
      let cmp = 0;
      switch (opts.sortBy) {
        case "date": cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "voucherNo": cmp = a.voucherNo.localeCompare(b.voucherNo); break;
      }
      return opts.sortDirection === "desc" ? -cmp : cmp;
    });

    return sorted.map((e) => {
      const row: Record<string, string> = {};
      for (const col of EXPENSE_COLUMNS) {
        if (!opts.visibleColumns.includes(col.key)) continue;
        switch (col.key) {
          case "date": row[col.label] = formatDate(String(e.date), opts.dateFormat); break;
          case "voucherNo": row[col.label] = e.voucherNo; break;
          case "category": row[col.label] = e.category.replace(/_/g, " "); break;
          case "description": row[col.label] = e.description; break;
          case "paidTo": row[col.label] = e.paidTo || ""; break;
          case "paymentMethod": row[col.label] = e.paymentMethod; break;
          case "project": row[col.label] = e.project?.projectName || ""; break;
          case "remarks": row[col.label] = e.remarks || ""; break;
          case "amount": row[col.label] = `Rs.${e.amount.toLocaleString()}`; break;
        }
      }
      return row;
    });
  }

  function handleExportPdf() {
    const opts = loadExportOptions();
    const topSession = sessions.length > 0 ? sessions[0] : null;

    // Sort RAW expenses BEFORE formatting dates (formatted dates can't be parsed back)
    const sorted = [...expenses].sort((a, b) => {
      let cmp = 0;
      switch (opts.sortBy) {
        case "date": cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "voucherNo": cmp = a.voucherNo.localeCompare(b.voucherNo); break;
      }
      return opts.sortDirection === "desc" ? -cmp : cmp;
    });

    // Now format dates AFTER sorting
    generateDailyCashReport({
      date: new Date().toISOString().split("T")[0],
      sessionVoucher: topSession?.voucherNo || "Daily Export",
      receivedFrom: topSession?.receivedFrom || "N/A",
      openingCash: topSession?.openingCash || 0,
      expenses: sorted.map((e) => ({
        date: formatDate(String(e.date), opts.dateFormat),
        voucherNo: e.voucherNo,
        category: e.category,
        description: e.description,
        paidTo: e.paidTo || "",
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        remarks: e.remarks || "",
        project: e.project?.projectName || undefined,
      })),
      visibleColumns: opts.visibleColumns,
    }).catch(() => window.alert("Could not generate the report. Please try again."));
  }

  function handleExportExcel() {
    const opts = loadExportOptions();
    const filtered = buildFilteredExpenses(opts);
    exportToExcel(filtered, `Expenses-${new Date().toISOString().split("T")[0]}`);
  }

  function handleExportApply(_opts: ExportOptions) {
    // Settings are already saved by the dialog; just close it
    // User clicks Export PDF / Export Excel to generate with saved settings
  }

  function openAdd() {
    setEditingId(null);
    // Auto-select the first (most recent) petty cash session if available
    setExpForm((prev) => ({
      ...prev,
      pettyCashId: sessions.length > 0 ? sessions[0].id : undefined,
    }));
    setExpenseOpen(true);
  }
  function openEdit(id: string) { setEditingId(id); setExpenseOpen(true); }
  function openDelete(id: string) { setDeletingId(id); setDeleteOpen(true); }

  function handlePcSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await createPettyCashSession(pcForm);
      if (result.error) { setFormError(result.error); return; }
      setPettyCashDialogOpen(false);
      setFeedback({ type: "success", message: "Petty cash session opened." });
      window.location.reload();
    });
  }

  function handleExpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateExpense(editingId, expForm)
        : await createExpense(expForm);
      if (result.error) { setFormError(result.error); return; }
      setExpenseOpen(false);
      setFeedback({ type: "success", message: editingId ? "Expense updated." : "Expense recorded." });
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    startTransition(async () => {
      const result = await deleteExpense(deletingId);
      if (result.error) { setFeedback({ type: "error", message: result.error }); setDeleteOpen(false); return; }
      setExpenses((prev) => prev.filter((e) => e.id !== deletingId));
      setDeleteOpen(false);
      setFeedback({ type: "success", message: "Expense deleted." });
    });
  }

  const filteredExpenses = expenses.filter((e) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      e.description.toLowerCase().includes(s) ||
      e.voucherNo.toLowerCase().includes(s) ||
      (e.paidTo ?? "").toLowerCase().includes(s)
    );
  });

  const cashBookEntries = filteredExpenses.filter((e) => e.paymentMethod === "CASH");
  const bankBookEntries = filteredExpenses.filter((e) => e.paymentMethod === "BANK");

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          feedback.type === "success"
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
        }`}>
          {feedback.message}
        </div>
      )}

      {/* Cash Summary Card */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-200/60 bg-white/80 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/80">
          <p className="text-xs font-medium text-zinc-500">Today's Opening</p>
          <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{fmt(todayCash.totalOpening)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/60 bg-white/80 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/80">
          <p className="text-xs font-medium text-zinc-500">Today's Expenses</p>
          <p className="mt-1 text-lg font-bold text-red-600">{fmt(todayCash.totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200/60 bg-white/80 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/80">
          <p className="text-xs font-medium text-zinc-500">Balance</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">{fmt(todayCash.balance)}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <>
            <Button onClick={() => setExportOptionsOpen(true)} variant="outline" className="gap-2">
              <Settings2 className="h-4 w-4" /> Export Options
            </Button>
            <Button onClick={handleExportPdf} variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Export PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline" className="gap-2">
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={() => setPettyCashDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Open Petty Cash
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </>
        )}
      </div>

      {/* Content based on tab */}
      {tab === "Petty Cash" && (
        <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Wallet className="h-10 w-10 text-zinc-300" />
              <p className="text-sm text-zinc-500">No petty cash sessions yet.</p>
            </div>
          ) : (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Voucher</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Received From</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Opening</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-zinc-600">{s.voucherNo}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">{s.receivedFrom}</td>
                      <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">{fmt(s.openingCash)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">{fmt(s.totalExpenses)}</td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{fmt(s.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(tab === "All Expenses" || tab === "Cash Book" || tab === "Bank Book") && (
        <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
          {filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <FileText className="h-10 w-10 text-zinc-300" />
              <p className="text-sm text-zinc-500">No expenses found.</p>
            </div>
          ) : (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Voucher</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Paid To</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Method</th>
                    {canEdit && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(tab === "Cash Book" ? cashBookEntries : tab === "Bank Book" ? bankBookEntries : filteredExpenses).map((e) => (
                    <tr key={e.id} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-zinc-600">{e.voucherNo}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{e.category.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate">{e.description}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{e.paidTo || "-"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-zinc-900 dark:text-zinc-100">{fmt(e.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.paymentMethod === "CASH" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                        }`}>
                          {e.paymentMethod}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(e.id)} className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => openDelete(e.id)} className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Petty Cash Session Dialog */}
      <Dialog open={pettyCashDialogOpen} onOpenChange={setPettyCashDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open Petty Cash Session</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePcSubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={pcForm.date} onChange={(e) => setPcForm({ ...pcForm, date: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Received From *</Label>
              <Input value={pcForm.receivedFrom} onChange={(e) => setPcForm({ ...pcForm, receivedFrom: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Opening Cash (Rs.)</Label>
              <Input type="number" min="0" value={pcForm.openingCash} onChange={(e) => setPcForm({ ...pcForm, openingCash: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Input value={pcForm.remarks ?? ""} onChange={(e) => setPcForm({ ...pcForm, remarks: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPettyCashDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Open Session"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleExpSubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description *</Label>
                <Input value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Paid To</Label>
                <Input value={expForm.paidTo ?? ""} onChange={(e) => setExpForm({ ...expForm, paidTo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (Rs.) *</Label>
                <Input type="number" min="1" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <select value={expForm.paymentMethod} onChange={(e) => setExpForm({ ...expForm, paymentMethod: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Link to Petty Cash Session</Label>
                <select value={expForm.pettyCashId ?? ""} onChange={(e) => setExpForm({ ...expForm, pettyCashId: e.target.value || undefined })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">None (standalone expense)</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.voucherNo} — {s.receivedFrom} — {fmt(s.openingCash)} ({fmt(s.remaining)} left)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Input value={expForm.remarks ?? ""} onChange={(e) => setExpForm({ ...expForm, remarks: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editingId ? "Update" : "Add Expense"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Options Dialog */}
      <ExportOptionsDialog
        open={exportOptionsOpen}
        onOpenChange={setExportOptionsOpen}
        onApply={handleExportApply}
        columns={EXPENSE_COLUMNS}
      />
    </div>
  );
}
