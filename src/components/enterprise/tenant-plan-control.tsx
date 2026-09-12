"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/providers/i18n-provider";
import { updateEnterpriseTenantPlan } from "@/lib/actions/enterprise-tenants";

const PLAN_OPTIONS = ["FREE", "PRO", "ENTERPRISE"] as const;

type TenantPlan = (typeof PLAN_OPTIONS)[number];

function planLabel(
  plan: TenantPlan,
  t: (key: "plan.free" | "plan.pro" | "plan.enterprise") => string
) {
  if (plan === "ENTERPRISE") return t("plan.enterprise");
  if (plan === "PRO") return t("plan.pro");
  return t("plan.free");
}

function planBadge(
  plan: TenantPlan,
  t: (key: "plan.free" | "plan.pro" | "plan.enterprise") => string
) {
  if (plan === "ENTERPRISE") return <Badge variant="default">{t("plan.enterprise")}</Badge>;
  if (plan === "PRO") return <Badge variant="success">{t("plan.pro")}</Badge>;
  return <Badge variant="secondary">{t("plan.free")}</Badge>;
}

export function TenantPlanControl({
  organizationId,
  currentPlan,
}: {
  organizationId: string;
  currentPlan: TenantPlan;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [selectedPlan, setSelectedPlan] = useState<TenantPlan>(currentPlan);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleUpdate() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("subscriptionStatus", selectedPlan);

      const result = await updateEnterpriseTenantPlan(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setMessage(t("enterprise.plan.updated"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        <span>{t("enterprise.plan.current")}</span>
        {planBadge(currentPlan, t)}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedPlan}
          onValueChange={(value) => setSelectedPlan(value as TenantPlan)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("enterprise.plan.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((plan) => (
              <SelectItem key={plan} value={plan}>
                {planLabel(plan, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={handleUpdate}
          disabled={isPending || selectedPlan === currentPlan}
        >
          {isPending ? t("common.updating") : t("enterprise.plan.update")}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
    </div>
  );
}
