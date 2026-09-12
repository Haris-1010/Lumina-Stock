"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganizationNameForCurrentOrganization } from "@/lib/actions/organization-settings";

export function OrgNameSettings({
  initialName,
  canManage,
}: {
  initialName: string;
  canManage: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await updateOrganizationNameForCurrentOrganization({ name });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setFeedback("Organization name updated.");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Update the name shown across your dashboard and documents.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] space-y-1">
          <Label htmlFor="org-name">Organization Name</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
            placeholder="Your organization name"
          />
        </div>
        <Button onClick={handleSave} disabled={!canManage || isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Saving..." : "Save Name"}
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {feedback && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          {feedback}
        </p>
      )}
    </div>
  );
}
