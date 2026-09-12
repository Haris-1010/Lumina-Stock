"use client";

import { formatCurrency } from "@/lib/utils";
import { useState, useEffect, useTransition } from "react";
import { Search, Plus, Pencil, Trash2, HardHat, Calendar, Download } from "lucide-react";
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
  createWorker,
  updateWorker,
  deleteWorker,
  markBulkAttendance,
  getAttendanceForDate,
  createPayment,
  getPaymentRegister,
  type WorkerFormInput,
  type AttendanceFormInput,
  type PaymentFormInput,
} from "@/lib/actions/labour";
import { getLabourRegisterExportData } from "@/lib/actions/exports";
import { generateLabourPaymentRegister } from "@/lib/pdf/reports";

type Worker = {
  id: string;
  workerCode: string;
  name: string;
  phone: string | null;
  cnic: string | null;
  skill: string;
  dailyWage: number;
  status: string;
  _count: { attendance: number; payments: number };
};

type Stats = {
  totalWorkers: number;
  activeWorkers: number;
  presentToday: number;
  totalPaid: number;
};

type AttendanceRecord = {
  workerId: string;
  workerCode: string;
  name: string;
  skill: string;
  dailyWage: number;
  attendance: {
    status: string;
    hoursWorked: number;
    overtimeHours: number;
    notes: string | null;
  } | null;
};

type Payment = {
  id: string;
  date: Date | string;
  periodStart: Date | string;
  periodEnd: Date | string;
  daysWorked: number;
  overtimeDays: number;
  totalAmount: number;
  paymentMethod: string;
  voucherNo: string | null;
  remarks: string | null;
  worker: { workerCode: string; name: string; skill: string };
};

const TABS = ["Workers", "Attendance", "Payments"] as const;
const SKILLS = ["MASON", "HELPER", "ELECTRICIAN", "PLUMBER", "CARPENTER", "PAINTER", "WELDER", "LABOURER", "OTHER"];
const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY"];

const EMPTY_WORKER: WorkerFormInput = { name: "", dailyWage: 0, skill: "LABOURER" };


export function LabourClient({
  initialWorkers,
  stats,
  currencyCode,
  canEdit,
}: {
  initialWorkers: Worker[];
  stats: Stats;
  currencyCode: string;
  canEdit: boolean;
}) {
  const fmt = (n: number) => formatCurrency(n, currencyCode);
  const [tab, setTab] = useState<string>("Workers");
  const [workers, setWorkers] = useState(initialWorkers);
  const [search, setSearch] = useState("");
  const [workerFormOpen, setWorkerFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerFormInput>(EMPTY_WORKER);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Attendance state
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [attEntries, setAttEntries] = useState<AttendanceRecord[]>([]);

  // Payment state
  const [payFormOpen, setPayFormOpen] = useState(false);
  const [payForm, setPayForm] = useState<PaymentFormInput>({
    workerId: "", periodStart: "", periodEnd: "", daysWorked: 0, totalAmount: 0, paymentMethod: "CASH",
  });
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => { setWorkers(initialWorkers); }, [initialWorkers]);

  useEffect(() => {
    if (!workerFormOpen) { setForm(EMPTY_WORKER); setEditingId(null); setFormError(null); }
  }, [workerFormOpen]);

  useEffect(() => {
    if (workerFormOpen && editingId) {
      const w = workers.find((x) => x.id === editingId);
      if (w) setForm({ name: w.name, phone: w.phone ?? undefined, cnic: w.cnic ?? undefined, skill: w.skill, dailyWage: w.dailyWage });
    }
  }, [workerFormOpen, editingId, workers]);

  // Load attendance when date or tab changes
  useEffect(() => {
    if (tab === "Attendance") {
      getAttendanceForDate(attDate).then(setAttEntries);
    }
  }, [tab, attDate]);

  // Load payments when tab changes
  useEffect(() => {
    if (tab === "Payments") {
      getPaymentRegister().then(setPayments);
    }
  }, [tab]);

  function handleExportPdf() {
    startTransition(async () => {
      const exportData = await getLabourRegisterExportData("");
      const data = {
        date: new Date().toISOString().split("T")[0],
        payments: exportData.map((p: any) => ({
          voucherNo: p["Voucher No"],
          workerName: p["Worker Name"],
          workerCode: p["Worker Code"],
          skill: p["Skill"],
          periodStart: p["Period Start"],
          periodEnd: p["Period End"],
          daysWorked: p["Days Worked"],
          overtimeDays: p["Overtime Days"],
          totalAmount: p["Total Amount"],
          paymentMethod: p["Payment Method"],
        })),
      };
      await generateLabourPaymentRegister(data).catch(() => setFeedback({ type: "error", message: "Could not generate the report. Please try again." }));
    });
  }

  function openAddWorker() { setEditingId(null); setWorkerFormOpen(true); }
  function openEditWorker(id: string) { setEditingId(id); setWorkerFormOpen(true); }
  function openDeleteWorker(id: string) { setDeletingId(id); setDeleteOpen(true); }

  function handleWorkerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingId ? await updateWorker(editingId, form) : await createWorker(form);
      if (result.error) { setFormError(result.error); return; }
      setWorkerFormOpen(false);
      setFeedback({ type: "success", message: editingId ? "Worker updated." : "Worker added." });
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    startTransition(async () => {
      const result = await deleteWorker(deletingId);
      if (result.error) { setFeedback({ type: "error", message: result.error }); setDeleteOpen(false); return; }
      setWorkers((prev) => prev.filter((w) => w.id !== deletingId));
      setDeleteOpen(false);
      setFeedback({ type: "success", message: "Worker deleted." });
    });
  }

  function handleAttendanceChange(workerId: string, field: string, value: any) {
    setAttEntries((prev) => prev.map((e) => {
      if (e.workerId !== workerId) return e;
      const att = e.attendance || { status: "ABSENT", hoursWorked: 8, overtimeHours: 0, notes: null };
      return { ...e, attendance: { ...att, [field]: value } };
    }));
  }

  function handleSaveAttendance() {
    startTransition(async () => {
      const entries: AttendanceFormInput[] = attEntries
        .filter((e) => e.attendance !== null)
        .map((e) => ({
          workerId: e.workerId,
          date: attDate,
          status: e.attendance!.status,
          hoursWorked: e.attendance!.hoursWorked,
          overtimeHours: e.attendance!.overtimeHours,
          notes: e.attendance!.notes ?? undefined,
        }));
      const result = await markBulkAttendance(entries);
      if (result.error) { setFeedback({ type: "error", message: result.error }); return; }
      setFeedback({ type: "success", message: "Attendance saved." });
    });
  }

  function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = await createPayment(payForm);
      if (result.error) { setFormError(result.error); return; }
      setPayFormOpen(false);
      setFeedback({ type: "success", message: "Payment recorded." });
      getPaymentRegister().then(setPayments);
    });
  }

  const filtered = workers.filter((w) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return w.name.toLowerCase().includes(s) || w.workerCode.toLowerCase().includes(s) || (w.phone ?? "").toLowerCase().includes(s);
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
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {[
          { label: "Total Workers", value: stats.totalWorkers },
          { label: "Active", value: stats.activeWorkers },
          { label: "Present Today", value: stats.presentToday },
          { label: "Total Paid", value: fmt(stats.totalPaid) },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-zinc-200/60 bg-white/80 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/80">
            <p className="text-xs font-medium text-zinc-500">{m.label}</p>
            <p className="mt-1 break-all text-lg font-bold text-zinc-900 dark:text-zinc-100">{m.value}</p>
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

      {/* Workers Tab */}
      {tab === "Workers" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input placeholder="Search workers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {canEdit && (
              <>
                <Button onClick={handleExportPdf} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Export PDF
                </Button>
                <Button onClick={openAddWorker} className="gap-2"><Plus className="h-4 w-4" /> Add Worker</Button>
              </>
            )}
          </div>
          <p className="text-sm text-zinc-500">{filtered.length} worker{filtered.length !== 1 ? "s" : ""}</p>
          <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <HardHat className="h-10 w-10 text-zinc-300" />
                <p className="text-sm text-zinc-500">No workers yet. Add your first worker.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Skill</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Daily Wage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                      {canEdit && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filtered.map((w) => (
                      <tr key={w.id} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3 text-sm font-mono text-zinc-600">{w.workerCode}</td>
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{w.name}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{w.phone || "-"}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{w.skill}</td>
                        <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">{fmt(w.dailyWage)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            w.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600"
                          }`}>{w.status}</span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditWorker(w.id)} className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Pencil className="h-4 w-4" /></button>
                              <button onClick={() => openDeleteWorker(w.id)} className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
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
        </>
      )}

      {/* Attendance Tab */}
      {tab === "Attendance" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <Input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className="w-40" />
            </div>
            {canEdit && (
              <Button onClick={handleSaveAttendance} disabled={isPending} className="gap-2">
                {isPending ? "Saving..." : "Save All"}
              </Button>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
            {attEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Calendar className="h-10 w-10 text-zinc-300" />
                <p className="text-sm text-zinc-500">No active workers for attendance.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Worker</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Hours</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">OT Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {attEntries.map((e) => (
                      <tr key={e.workerId} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{e.name}</p>
                          <p className="text-xs text-zinc-500">{e.workerCode} · {e.skill}</p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={e.attendance?.status ?? "ABSENT"}
                            onChange={(ev) => handleAttendanceChange(e.workerId, "status", ev.target.value)}
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            max="24"
                            value={e.attendance?.hoursWorked ?? 8}
                            onChange={(ev) => handleAttendanceChange(e.workerId, "hoursWorked", Number(ev.target.value))}
                            className="w-20"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            value={e.attendance?.overtimeHours ?? 0}
                            onChange={(ev) => handleAttendanceChange(e.workerId, "overtimeHours", Number(ev.target.value))}
                            className="w-20"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {tab === "Payments" && (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => setPayFormOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Record Payment</Button>
            </div>
          )}
          <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
            {payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <HardHat className="h-10 w-10 text-zinc-300" />
                <p className="text-sm text-zinc-500">No payments recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Voucher</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Worker</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Period</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Days</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">OT</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                        <td className="px-4 py-3 text-sm font-mono text-zinc-600">{p.voucherNo}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{new Date(p.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">{p.worker.name}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{new Date(p.periodStart).toLocaleDateString()} - {new Date(p.periodEnd).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-zinc-600">{p.daysWorked}</td>
                        <td className="px-4 py-3 text-sm text-right text-zinc-600">{p.overtimeDays}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-zinc-900 dark:text-zinc-100">{fmt(p.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.paymentMethod === "CASH" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                          }`}>{p.paymentMethod}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Worker Form Dialog */}
      <Dialog open={workerFormOpen} onOpenChange={setWorkerFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Worker" : "Add Worker"}</DialogTitle></DialogHeader>
          <form onSubmit={handleWorkerSubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>CNIC</Label>
                <Input value={form.cnic ?? ""} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Skill</Label>
                <select value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Daily Wage (Rs.)</Label>
                <Input type="number" min="0" value={form.dailyWage} onChange={(e) => setForm({ ...form, dailyWage: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWorkerFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editingId ? "Update" : "Add Worker"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Form Dialog */}
      <Dialog open={payFormOpen} onOpenChange={setPayFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Worker *</Label>
                <select value={payForm.workerId} onChange={(e) => setPayForm({ ...payForm, workerId: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" required>
                  <option value="">Select worker</option>
                  {workers.filter((w) => w.status === "ACTIVE").map((w) => <option key={w.id} value={w.id}>{w.name} ({w.workerCode})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Period Start *</Label>
                <Input type="date" value={payForm.periodStart} onChange={(e) => setPayForm({ ...payForm, periodStart: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Period End *</Label>
                <Input type="date" value={payForm.periodEnd} onChange={(e) => setPayForm({ ...payForm, periodEnd: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Days Worked *</Label>
                <Input type="number" min="1" value={payForm.daysWorked} onChange={(e) => setPayForm({ ...payForm, daysWorked: Number(e.target.value) })} required />
              </div>
              <div className="space-y-1.5">
                <Label>OT Days</Label>
                <Input type="number" min="0" value={payForm.overtimeDays ?? 0} onChange={(e) => setPayForm({ ...payForm, overtimeDays: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Total Amount (Rs.) *</Label>
                <Input type="number" min="1" value={payForm.totalAmount} onChange={(e) => setPayForm({ ...payForm, totalAmount: Number(e.target.value) })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Remarks</Label>
                <Input value={payForm.remarks ?? ""} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Record Payment"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Worker</DialogTitle></DialogHeader>
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
