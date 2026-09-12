"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  PAGE_PERMISSION_KEYS,
  ACTION_PERMISSION_KEYS,
  PAGE_PERMISSION_LABELS,
  ACTION_PERMISSION_LABELS,
  PRODUCT_OWNER_GATED_PAGES,
  PRODUCT_OWNER_GATED_ACTIONS,
  type PagePermissionKey,
  type ActionPermissionKey,
} from "@/lib/permission-definitions";

const GATED_PAGES = new Set<string>(PRODUCT_OWNER_GATED_PAGES);
const GATED_ACTIONS = new Set<string>(PRODUCT_OWNER_GATED_ACTIONS);
import { updateTenantEntitlements } from "@/lib/actions/enterprise-tenants";

// Platform governance is controlled by the platform-admin boundary, not tenant
// entitlements — hide those keys here to avoid confusion.
const HIDDEN_PAGES = new Set<PagePermissionKey>(["platformTenants", "platformAudit"]);
const HIDDEN_ACTIONS = new Set<ActionPermissionKey>(["platformGovernanceManage"]);
// Lifelines: can never be stripped (a tenant would be unrecoverable).
const LOCKED_PAGES = new Set<PagePermissionKey>(["settings"]);
const LOCKED_ACTIONS = new Set<ActionPermissionKey>(["managePermissions"]);

type EntitlementMaps = {
  pages: Record<string, boolean>;
  actions: Record<string, boolean>;
};

export function TenantEntitlementsControl({
  organizationId,
  entitlements,
}: {
  organizationId: string;
  entitlements: EntitlementMaps;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pageKeys = useMemo(
    () => PAGE_PERMISSION_KEYS.filter((k) => !HIDDEN_PAGES.has(k)),
    []
  );
  const actionKeys = useMemo(
    () => ACTION_PERMISSION_KEYS.filter((k) => !HIDDEN_ACTIONS.has(k)),
    []
  );

  const [pages, setPages] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const k of pageKeys) next[k] = entitlements.pages[k] !== false;
    return next;
  });
  const [actions, setActions] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const k of actionKeys) next[k] = entitlements.actions[k] !== false;
    return next;
  });

  function setAll(value: boolean) {
    setPages((prev) => {
      const next = { ...prev };
      for (const k of pageKeys) if (!LOCKED_PAGES.has(k)) next[k] = value;
      return next;
    });
    setActions((prev) => {
      const next = { ...prev };
      for (const k of actionKeys) if (!LOCKED_ACTIONS.has(k)) next[k] = value;
      return next;
    });
  }

  function handleSave() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await updateTenantEntitlements({
        organizationId,
        entitlements: {
          pages: { ...pages, settings: true },
          actions: { ...actions, managePermissions: true },
        },
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMessage("Tenant access updated. Changes apply on the user's next request.");
      router.refresh();
    });
  }

  const row = (
    label: string,
    checked: boolean,
    locked: boolean,
    onToggle: (v: boolean) => void,
    gated = false
  ) => (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-zinc-700 dark:text-zinc-300">
        {label}
        {locked && (
          <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Always on
          </span>
        )}
        {gated && !locked && (
          <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            Off by default
          </span>
        )}
      </span>
      <Switch
        checked={locked ? true : checked}
        disabled={locked || isPending}
        onCheckedChange={onToggle}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAll(true)} disabled={isPending}>
          Enable all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setAll(false)} disabled={isPending}>
          Disable all
        </Button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Disabled features are hidden for <strong>everyone</strong> in this tenant, including its Owner.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Feature Pages
          </p>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {pageKeys.map((k) =>
              row(
                PAGE_PERMISSION_LABELS[k],
                pages[k],
                LOCKED_PAGES.has(k),
                (v) => setPages((prev) => ({ ...prev, [k]: v })),
                GATED_PAGES.has(k)
              )
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Actions
          </p>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {actionKeys.map((k) =>
              row(
                ACTION_PERMISSION_LABELS[k],
                actions[k],
                LOCKED_ACTIONS.has(k),
                (v) => setActions((prev) => ({ ...prev, [k]: v })),
                GATED_ACTIONS.has(k)
              )
            )}
          </div>
        </div>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <Button type="button" onClick={handleSave} disabled={isPending}>
        {isPending ? "Saving…" : "Save tenant access"}
      </Button>
    </div>
  );
}
