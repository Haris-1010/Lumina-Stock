"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, UserPlus, Trash2, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ACTION_PERMISSION_LABELS,
  PAGE_PERMISSION_KEYS,
  PAGE_PERMISSION_LABELS,
  type ActionPermissionKey,
  type PagePermissionKey,
  type PermissionState,
} from "@/lib/permission-definitions";
import {
  updateUserPermissionsForCurrentOrganization,
  createEmployeeForCurrentOrganization,
  deleteEmployeeFromCurrentOrganization,
} from "@/lib/actions/permissions";

type UserRole = "OWNER" | "ADMIN" | "MEMBER";

interface PermissionSettingsUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: PermissionState;
}

const ACTION_SECTIONS: Array<{
  id: string;
  heading: string;
  description?: string;
  actionKeys: ActionPermissionKey[];
}> = [
  {
    id: "inventory",
    heading: PAGE_PERMISSION_LABELS.inventory,
    actionKeys: ["inventoryEdit", "inventoryDelete"],
  },
  {
    id: "cashier",
    heading: PAGE_PERMISSION_LABELS.cashier,
    actionKeys: ["cashierCheckout"],
  },
  {
    id: "invoices",
    heading: PAGE_PERMISSION_LABELS.invoices,
    actionKeys: ["invoicesManage", "invoicesDelete", "invoicePaymentsManage"],
  },
  {
    id: "purchase-orders",
    heading: PAGE_PERMISSION_LABELS.purchaseOrders,
    actionKeys: ["purchaseOrdersManage"],
  },
  {
    id: "record-controls",
    heading: PAGE_PERMISSION_LABELS.recordControls,
    actionKeys: ["recordControlsManage"],
  },
  {
    id: "settings",
    heading: PAGE_PERMISSION_LABELS.settings,
    actionKeys: ["apiKeysManage", "billingManage", "csvImport", "webImport", "managePermissions"],
  },
  {
    id: "forecasts",
    heading: PAGE_PERMISSION_LABELS.forecasts,
    description: "AI assistant access is used in Forecasts and dashboard assistant widgets.",
    actionKeys: ["aiAssistantAccess"],
  },
  {
    id: "platform",
    heading: "Platform Tenant Controls + Platform Audit",
    actionKeys: ["platformGovernanceManage"],
  },
];

function roleLabel(role: UserRole) {
  if (role === "OWNER") return "Owner";
  if (role === "ADMIN") return "Admin";
  return "Member";
}

const ROLE_BADGE: Record<UserRole, string> = {
  OWNER: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  MEMBER: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export function PermissionManager({
  users: initialUsers,
  actorUserId,
}: {
  users: PermissionSettingsUser[];
  actorUserId: string | null;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<PermissionSettingsUser[]>(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState(initialUsers[0]?.id || "");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [draftByUserId, setDraftByUserId] = useState<Record<string, PermissionState>>(() =>
    Object.fromEntries(initialUsers.map((u) => [u.id, u.permissions]))
  );

  // Add-employee dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "MEMBER" as "ADMIN" | "MEMBER" });
  const [showPassword, setShowPassword] = useState(false);
  const [addPending, startAddTransition] = useTransition();
  const [addFeedback, setAddFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Delete confirmation state
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const draft = selectedUser ? draftByUserId[selectedUser.id] : null;

  function togglePagePermission(key: PagePermissionKey, nextValue: boolean) {
    if (!selectedUser) return;
    setDraftByUserId((prev) => ({
      ...prev,
      [selectedUser.id]: {
        ...prev[selectedUser.id],
        pages: { ...prev[selectedUser.id].pages, [key]: nextValue },
      },
    }));
  }

  function toggleActionPermission(key: ActionPermissionKey, nextValue: boolean) {
    if (!selectedUser) return;
    setDraftByUserId((prev) => ({
      ...prev,
      [selectedUser.id]: {
        ...prev[selectedUser.id],
        actions: { ...prev[selectedUser.id].actions, [key]: nextValue },
      },
    }));
  }

  function savePermissions() {
    if (!selectedUser || !draft) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await updateUserPermissionsForCurrentOrganization({
        userId: selectedUser.id,
        permissions: draft,
      });
      if (result?.error) {
        setFeedback({ type: "error", message: result.error });
        return;
      }
      setFeedback({ type: "success", message: "Permissions saved." });
      // Re-fetch the layout/sidebar and page guards so visibility changes for
      // the affected user (and the actor, if they edited their own access)
      // take effect immediately instead of only after a manual reload.
      router.refresh();
    });
  }

  function handleAddEmployee() {
    setAddFeedback(null);
    startAddTransition(async () => {
      const result = await createEmployeeForCurrentOrganization(addForm);
      if ("error" in result) {
        setAddFeedback({ type: "error", message: result.error });
        return;
      }
      setUsers((prev) => [...prev, result.user]);
      setDraftByUserId((prev) => ({ ...prev, [result.user.id]: result.user.permissions }));
      setSelectedUserId(result.user.id);
      setAddForm({ name: "", email: "", password: "", role: "MEMBER" });
      setShowAddDialog(false);
      setFeedback({ type: "success", message: `${result.user.name} was added successfully.` });
    });
  }

  function handleDeleteEmployee(userId: string) {
    startDeleteTransition(async () => {
      const result = await deleteEmployeeFromCurrentOrganization({ userId });
      if ("error" in result) {
        setFeedback({ type: "error", message: result.error });
        setDeleteConfirmUserId(null);
        return;
      }
      const remaining = users.filter((u) => u.id !== userId);
      setUsers(remaining);
      setDeleteConfirmUserId(null);
      if (selectedUserId === userId) {
        setSelectedUserId(remaining[0]?.id || "");
      }
      setFeedback({ type: "success", message: "Employee removed." });
    });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {users.length} {users.length === 1 ? "employee" : "employees"} in your organization
        </p>
        <Button variant="outline" size="sm" onClick={() => { setAddFeedback(null); setShowAddDialog(true); }}>
          <UserPlus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {/* Employee selector + save */}
      {users.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] space-y-1">
            <Label>Employee</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({roleLabel(u.role)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={savePermissions} disabled={!selectedUser || !draft || isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "Saving..." : "Save Permissions"}
          </Button>
        </div>
      )}

      {users.length === 0 && (
        <p className="text-sm text-zinc-500">No employees yet. Add one above.</p>
      )}

      {/* Selected employee info + delete */}
      {selectedUser && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ROLE_BADGE[selectedUser.role]}`}>
              {roleLabel(selectedUser.role)}
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{selectedUser.name}</span>
            <span className="text-zinc-500">{selectedUser.email}</span>
            {selectedUser.id === actorUserId && <span className="text-zinc-400">(you)</span>}
          </div>

          {selectedUser.role !== "OWNER" && selectedUser.id !== actorUserId && (
            deleteConfirmUserId === selectedUser.id ? (
              <div className="flex items-center gap-2">
                <span className="text-red-600 text-xs">Remove this employee?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletePending}
                  onClick={() => handleDeleteEmployee(selectedUser.id)}
                >
                  {deletePending ? "Removing..." : "Yes, Remove"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirmUserId(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => setDeleteConfirmUserId(selectedUser.id)}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )
          )}
        </div>
      )}

      {/* Save feedback */}
      {feedback && (
        <p className={`rounded-md border p-3 text-sm ${
          feedback.type === "error"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        }`}>
          {feedback.message}
        </p>
      )}

      {/* Permission editor */}
      {selectedUser && draft && (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Page Visibility</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAGE_PERMISSION_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <Checkbox
                    checked={draft.pages[key]}
                    onCheckedChange={(checked) => togglePagePermission(key, Boolean(checked))}
                  />
                  {PAGE_PERMISSION_LABELS[key]}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Action Permissions by Page</h3>
            <div className="space-y-4">
              {ACTION_SECTIONS.map((section) => (
                <div key={section.id} className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                      {section.heading}
                    </h4>
                    {section.description && (
                      <p className="mt-1 text-xs text-zinc-500">{section.description}</p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {section.actionKeys.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <Checkbox
                          checked={draft.actions[key]}
                          onCheckedChange={(checked) => toggleActionPermission(key, Boolean(checked))}
                        />
                        {ACTION_PERMISSION_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>
              Create a login account for a new team member. They can sign in immediately with these credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Full Name</Label>
              <Input
                id="emp-name"
                placeholder="e.g. Sarah Khan"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-email">Email Address</Label>
              <Input
                id="emp-email"
                type="email"
                placeholder="sarah@yourcompany.com"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-password">Temporary Password</Label>
              <div className="relative">
                <Input
                  id="emp-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-role">Role</Label>
              <Select
                value={addForm.role}
                onValueChange={(v) => setAddForm((f) => ({ ...f, role: v as "ADMIN" | "MEMBER" }))}
              >
                <SelectTrigger id="emp-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member — standard access, no admin actions</SelectItem>
                  <SelectItem value="ADMIN">Admin — full access except billing &amp; permissions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role explanation */}
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 space-y-1">
              {addForm.role === "MEMBER" ? (
                <>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Member defaults</p>
                  <p>Can access: Inventory, Cashier, Sales, Customers, Invoices, and more.</p>
                  <p>Cannot: edit inventory, manage purchase orders, access Settings or billing.</p>
                  <p className="text-zinc-400">You can fine-tune these after creating the account.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Admin defaults</p>
                  <p>Full access to all operational pages including edit/delete actions.</p>
                  <p>Cannot: manage billing, manage API keys, or change employee permissions.</p>
                  <p className="text-zinc-400">You can fine-tune these after creating the account.</p>
                </>
              )}
            </div>

            {addFeedback && (
              <p className={`rounded-md border p-3 text-sm ${
                addFeedback.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}>
                {addFeedback.message}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={addPending}>
                Cancel
              </Button>
              <Button
                onClick={handleAddEmployee}
                disabled={addPending || !addForm.name || !addForm.email || !addForm.password}
              >
                <UserPlus className="h-4 w-4" />
                {addPending ? "Creating..." : "Create Employee"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
