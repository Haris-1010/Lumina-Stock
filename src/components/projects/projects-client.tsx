"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, Plus, Pencil, Trash2, FolderKanban } from "lucide-react";
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
  createProject,
  updateProject,
  deleteProject,
  type ProjectFormInput,
} from "@/lib/actions/projects";

type Project = {
  id: string;
  projectCode: string;
  projectName: string;
  location: string | null;
  status: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  estimatedBudget: number;
  actualCost: number;
  _count: { expenses: number; workOrders: number };
};

type Stats = {
  total: number;
  planning: number;
  inProgress: number;
  completed: number;
  onHold: number;
};

const STATUS_TABS = ["ALL", "PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED"] as const;

const EMPTY_FORM: ProjectFormInput = {
  projectName: "",
  location: "",
  description: "",
  status: "PLANNING",
  estimatedBudget: 0,
};

const fmt = (n: number) => `Rs.${n.toLocaleString()}`;

export function ProjectsClient({
  initialProjects,
  stats,
  currencyCode,
  canEdit,
}: {
  initialProjects: Project[];
  stats: Stats;
  currencyCode: string;
  canEdit: boolean;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setProjects(initialProjects); }, [initialProjects]);

  useEffect(() => {
    if (!formOpen) { setForm(EMPTY_FORM); setEditingId(null); setFormError(null); }
  }, [formOpen]);

  useEffect(() => {
    if (formOpen && editingId) {
      const p = projects.find((x) => x.id === editingId);
      if (p) setForm({
        projectName: p.projectName,
        location: p.location ?? "",
        status: p.status,
        estimatedBudget: p.estimatedBudget,
      });
    }
  }, [formOpen, editingId, projects]);

  function openAdd() { setEditingId(null); setFormOpen(true); }
  function openEdit(id: string) { setEditingId(id); setFormOpen(true); }
  function openDelete(id: string) { setDeletingId(id); setDeleteOpen(true); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateProject(editingId, form)
        : await createProject(form);
      if (result.error) { setFormError(result.error); return; }
      setFormOpen(false);
      setFeedback({ type: "success", message: editingId ? "Project updated." : "Project created." });
      window.location.reload();
    });
  }

  function handleDelete() {
    if (!deletingId) return;
    startTransition(async () => {
      const result = await deleteProject(deletingId);
      if (result.error) { setFeedback({ type: "error", message: result.error }); setDeleteOpen(false); return; }
      setProjects((prev) => prev.filter((p) => p.id !== deletingId));
      setDeleteOpen(false);
      setFeedback({ type: "success", message: "Project deleted." });
    });
  }

  const filtered = projects.filter((p) => {
    const matchSearch = !search.trim() ||
      p.projectName.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode.toLowerCase().includes(search.toLowerCase()) ||
      (p.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusTab === "ALL" || p.status === statusTab;
    return matchSearch && matchStatus;
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total },
          { label: "Planning", value: stats.planning },
          { label: "In Progress", value: stats.inProgress },
          { label: "Completed", value: stats.completed },
          { label: "On Hold", value: stats.onHold },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-zinc-200/60 bg-white/80 p-3 dark:border-zinc-700/60 dark:bg-zinc-900/80">
            <p className="text-xs font-medium text-zinc-500">{m.label}</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button key={tab} onClick={() => setStatusTab(tab)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            statusTab === tab ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}>{tab.replace(/_/g, " ")}</button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Project</Button>}
      </div>

      <p className="text-sm text-zinc-500">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</p>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm overflow-hidden dark:border-zinc-700/60 dark:bg-zinc-900/80">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <FolderKanban className="h-10 w-10 text-zinc-300" />
            <p className="text-sm text-zinc-500">No projects found. Create your first project.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Budget</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">WOs</th>
                    {canEdit && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 transition-colors dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-sm font-mono text-zinc-600">{p.projectCode}</td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.projectName}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{p.location || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" :
                          p.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" :
                          p.status === "ON_HOLD" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                          "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>{p.status.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">{fmt(p.estimatedBudget)}</td>
                      <td className="px-4 py-3 text-sm text-right text-zinc-600">{p._count.expenses}</td>
                      <td className="px-4 py-3 text-sm text-right text-zinc-600">{p._count.workOrders}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(p.id)} className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => openDelete(p.id)} className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.projectName}</p>
                      <p className="text-xs text-zinc-500">{p.projectCode} · {p.location || "No location"}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "IN_PROGRESS" ? "bg-blue-50 text-blue-700" :
                      p.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" :
                      p.status === "ON_HOLD" ? "bg-amber-50 text-amber-700" :
                      "bg-zinc-100 text-zinc-600"
                    }`}>{p.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Budget: {fmt(p.estimatedBudget)}</p>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p.id)} className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => openDelete(p.id)} className="p-2 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
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
          <DialogHeader><DialogTitle>{editingId ? "Edit Project" : "Add Project"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            {formError && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{formError}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Project Name *</Label>
                <Input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="PLANNING">Planning</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate ?? ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate ?? ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Estimated Budget (Rs.)</Label>
                <Input type="number" min="0" value={form.estimatedBudget ?? 0} onChange={(e) => setForm({ ...form, estimatedBudget: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editingId ? "Update" : "Create Project"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Project</DialogTitle></DialogHeader>
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
