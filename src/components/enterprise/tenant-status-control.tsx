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
import {
  approveEnterpriseTenantReactivation,
  rejectEnterpriseTenantReactivation,
  requestEnterpriseTenantReactivation,
  updateEnterpriseTenantStatus,
} from "@/lib/actions/enterprise-tenants";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS = ["ACTIVE", "SUSPENDED"] as const;

type TenantStatus = (typeof STATUS_OPTIONS)[number];

type PendingReactivationRequest = {
  requestAuditLogId: string;
  requestedAt: string | Date;
  requestedByEmail: string;
  details: string | null;
  canApprove: boolean;
};

function statusLabel(
  status: TenantStatus,
  t: (key: "status.active" | "status.suspended") => string
) {
  if (status === "SUSPENDED") return t("status.suspended");
  return t("status.active");
}

function statusBadge(
  status: TenantStatus,
  t: (key: "status.active" | "status.suspended") => string
) {
  if (status === "SUSPENDED") return <Badge variant="destructive">{t("status.suspended")}</Badge>;
  return <Badge variant="success">{t("status.active")}</Badge>;
}

export function TenantStatusControl({
  organizationId,
  currentStatus,
  currentReason,
  reactivationRequest,
}: {
  organizationId: string;
  currentStatus: TenantStatus;
  currentReason?: string | null;
  reactivationRequest?: PendingReactivationRequest | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [selectedStatus, setSelectedStatus] = useState<TenantStatus>(currentStatus);
  const [reason, setReason] = useState<string>(currentReason || "");
  const [reactivationNote, setReactivationNote] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const hasPendingRequest = Boolean(reactivationRequest);
  const canApproveRequest = Boolean(reactivationRequest?.canApprove);
  const isSuspensionFlow = selectedStatus === "SUSPENDED";
  const isReactivationFlow =
    selectedStatus === "ACTIVE" && currentStatus === "SUSPENDED";

  const actionDisabled =
    isPending ||
    (isSuspensionFlow &&
      (selectedStatus === currentStatus || reason.trim().length === 0)) ||
    (selectedStatus === currentStatus && currentStatus === "ACTIVE") ||
    (isReactivationFlow && hasPendingRequest && !canApproveRequest);

  const actionLabel = isSuspensionFlow
    ? t("enterprise.status.suspendTenant")
    : !hasPendingRequest
      ? t("enterprise.status.requestReactivation")
      : canApproveRequest
        ? t("enterprise.status.approveReactivation")
        : t("enterprise.status.awaitingApproval");

  const canRejectRequest =
    isReactivationFlow && hasPendingRequest && canApproveRequest && !isPending;

  function handleUpdate() {
    setMessage("");
    setError("");

    startTransition(async () => {
      if (isSuspensionFlow) {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("lifecycleStatus", "SUSPENDED");
        formData.set("reason", reason);

        const result = await updateEnterpriseTenantStatus(formData);
        if (result?.error) {
          setError(result.error);
          return;
        }

        setMessage(t("enterprise.status.updated"));
        router.refresh();
        return;
      }

      if (!isReactivationFlow) {
        setError(t("enterprise.status.selectFlowError"));
        return;
      }

      if (!hasPendingRequest) {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("requestNote", reactivationNote);

        const result = await requestEnterpriseTenantReactivation(formData);
        if (result?.error) {
          setError(result.error);
          return;
        }

        setMessage(
          t("enterprise.status.requestSubmitted")
        );
        setReactivationNote("");
        router.refresh();
        return;
      }

      if (!canApproveRequest) {
        setError(t("enterprise.status.approvalNeedsDifferentAdmin"));
        return;
      }

      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("approvalNote", reactivationNote);

      const result = await approveEnterpriseTenantReactivation(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setMessage(t("enterprise.status.reactivated"));
      setReactivationNote("");
      router.refresh();
    });
  }

  function handleReject() {
    setMessage("");
    setError("");

    startTransition(async () => {
      if (!isReactivationFlow || !hasPendingRequest) {
        setError(t("enterprise.status.noPendingReject"));
        return;
      }

      if (!canApproveRequest) {
        setError(t("enterprise.status.rejectionNeedsDifferentAdmin"));
        return;
      }

      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("rejectionNote", reactivationNote);

      const result = await rejectEnterpriseTenantReactivation(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setMessage(t("enterprise.status.requestRejected"));
      setReactivationNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        <span>{t("enterprise.status.current")}</span>
        {statusBadge(currentStatus, t)}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedStatus}
          onValueChange={(value) => setSelectedStatus(value as TenantStatus)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("enterprise.status.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={isSuspensionFlow ? "destructive" : "outline"}
          onClick={handleUpdate}
          disabled={actionDisabled}
        >
          {isPending ? t("common.updating") : actionLabel}
        </Button>

        {canRejectRequest && (
          <Button variant="destructive" onClick={handleReject}>
            {t("enterprise.status.rejectRequest")}
          </Button>
        )}
      </div>

      {currentStatus === "SUSPENDED" && reactivationRequest && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <p className="font-medium">{t("enterprise.status.pendingTitle")}</p>
          <p>
            {t("enterprise.status.requestedByOn", {
              email: reactivationRequest.requestedByEmail,
              date: formatDate(reactivationRequest.requestedAt),
            })}
          </p>
          {reactivationRequest.details && (
            <p>{t("enterprise.status.requestNote", { note: reactivationRequest.details })}</p>
          )}
          {!reactivationRequest.canApprove && (
            <p className="pt-1">
              {t("enterprise.status.approvalNeedsDifferentAdmin")}
            </p>
          )}
        </div>
      )}

      {isSuspensionFlow && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700">{t("enterprise.status.suspensionReason")}</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 240))}
            placeholder={t("enterprise.status.suspensionPlaceholder")}
            className="min-h-[88px] w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <p className="text-[11px] text-zinc-500">
            {t("enterprise.status.charactersCount", { count: reason.length })}
          </p>
        </div>
      )}

      {isReactivationFlow && (!hasPendingRequest || canApproveRequest) && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700">
            {hasPendingRequest
              ? t("enterprise.status.noteApproval")
              : t("enterprise.status.noteRequest")}
          </label>
          <textarea
            value={reactivationNote}
            onChange={(event) => setReactivationNote(event.target.value.slice(0, 240))}
            placeholder={
              hasPendingRequest
                ? t("enterprise.status.noteApprovalPlaceholder")
                : t("enterprise.status.noteRequestPlaceholder")
            }
            className="min-h-[88px] w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <p className="text-[11px] text-zinc-500">
            {t("enterprise.status.charactersCount", { count: reactivationNote.length })}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
    </div>
  );
}
