"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  EnterpriseTenantRow,
  TenantHealth,
  TenantLifecycleStatus,
} from "@/lib/actions/enterprise-tenants";

function healthBadge(health: TenantHealth, t: (key: Parameters<ReturnType<typeof useI18n>["t"]>[0]) => string) {
  if (health === "SUSPENDED") return <Badge variant="destructive">{t("enterprise.table.health.suspended")}</Badge>;
  if (health === "HEALTHY") return <Badge variant="success">{t("enterprise.table.health.healthy")}</Badge>;
  if (health === "LIMIT_RISK") return <Badge variant="warning">{t("enterprise.table.health.limitRisk")}</Badge>;
  if (health === "INACTIVE") return <Badge variant="secondary">{t("enterprise.table.health.inactive")}</Badge>;
  return <Badge variant="secondary">{t("enterprise.table.health.new")}</Badge>;
}

function lifecycleBadge(status: TenantLifecycleStatus, t: (key: Parameters<ReturnType<typeof useI18n>["t"]>[0]) => string) {
  if (status === "SUSPENDED") return <Badge variant="destructive">{t("status.suspended")}</Badge>;
  return <Badge variant="success">{t("status.active")}</Badge>;
}

function planBadge(
  plan: EnterpriseTenantRow["subscriptionStatus"],
  t: (key: Parameters<ReturnType<typeof useI18n>["t"]>[0]) => string
) {
  if (plan === "ENTERPRISE") return <Badge variant="default">{t("plan.enterprise")}</Badge>;
  if (plan === "PRO") return <Badge variant="success">{t("plan.pro")}</Badge>;
  return <Badge variant="secondary">{t("plan.free")}</Badge>;
}

export function TenantTable({ tenants }: { tenants: EnterpriseTenantRow[] }) {
  const { t, language } = useI18n();
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"ALL" | "FREE" | "PRO" | "ENTERPRISE">("ALL");
  const [healthFilter, setHealthFilter] = useState<"ALL" | TenantHealth>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TenantLifecycleStatus>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const normalizedQuery = query.trim().toLowerCase();
      const queryMatch =
        normalizedQuery.length === 0 ||
        tenant.name.toLowerCase().includes(normalizedQuery) ||
        tenant.id.toLowerCase().includes(normalizedQuery);

      const planMatch = planFilter === "ALL" || tenant.subscriptionStatus === planFilter;
      const healthMatch = healthFilter === "ALL" || tenant.tenantHealth === healthFilter;
      const statusMatch = statusFilter === "ALL" || tenant.lifecycleStatus === statusFilter;

      return queryMatch && planMatch && healthMatch && statusMatch;
    });
  }, [tenants, query, planFilter, healthFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedTenants = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredTenants.slice(start, start + pageSize);
  }, [filteredTenants, safePage, pageSize]);

  if (tenants.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        {t("enterprise.table.noTenants")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder={t("enterprise.table.searchPlaceholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={planFilter}
          onValueChange={(value) => {
            setPlanFilter(value as typeof planFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("enterprise.table.columns.plan")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("enterprise.table.allPlans")}</SelectItem>
            <SelectItem value="FREE">{t("plan.free")}</SelectItem>
            <SelectItem value="PRO">{t("plan.pro")}</SelectItem>
            <SelectItem value="ENTERPRISE">{t("plan.enterprise")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={healthFilter}
          onValueChange={(value) => {
            setHealthFilter(value as typeof healthFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("enterprise.table.columns.health")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("enterprise.table.allHealth")}</SelectItem>
            <SelectItem value="HEALTHY">{t("enterprise.table.health.healthy")}</SelectItem>
            <SelectItem value="LIMIT_RISK">{t("enterprise.table.health.limitRisk")}</SelectItem>
            <SelectItem value="INACTIVE">{t("enterprise.table.health.inactive")}</SelectItem>
            <SelectItem value="NEW">{t("enterprise.table.health.new")}</SelectItem>
            <SelectItem value="SUSPENDED">{t("enterprise.table.health.suspended")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as typeof statusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("enterprise.table.columns.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("enterprise.table.allStatus")}</SelectItem>
            <SelectItem value="ACTIVE">{t("status.active")}</SelectItem>
            <SelectItem value="SUSPENDED">{t("status.suspended")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("enterprise.table.columns.tenant")}</TableHead>
              <TableHead>{t("enterprise.table.columns.plan")}</TableHead>
              <TableHead>{t("enterprise.table.columns.status")}</TableHead>
              <TableHead>{t("enterprise.table.columns.health")}</TableHead>
              <TableHead className="text-right">{t("enterprise.table.columns.users")}</TableHead>
              <TableHead className="text-right">{t("enterprise.table.columns.products")}</TableHead>
              <TableHead className="text-right">{t("enterprise.table.columns.activeApiKeys")}</TableHead>
              <TableHead className="text-right">{t("enterprise.table.columns.revenue30")}</TableHead>
              <TableHead>{t("enterprise.table.columns.lastActivity")}</TableHead>
              <TableHead className="text-right">{t("enterprise.table.columns.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{tenant.name}</p>
                    <p
                      className="mt-0.5 font-mono text-[10px] leading-none text-zinc-400 dark:text-zinc-600 select-all"
                      title={tenant.id}
                    >
                      {tenant.id.slice(0, 12)}…
                    </p>
                  </div>
                </TableCell>
                <TableCell>{planBadge(tenant.subscriptionStatus, t)}</TableCell>
                <TableCell>{lifecycleBadge(tenant.lifecycleStatus, t)}</TableCell>
                <TableCell>{healthBadge(tenant.tenantHealth, t)}</TableCell>
                <TableCell className="text-right">{tenant.usersCount}</TableCell>
                <TableCell className="text-right">
                  {tenant.productsCount} / {tenant.planProductsLimitLabel}
                </TableCell>
                <TableCell className="text-right">
                  {tenant.activeApiKeysCount} / {tenant.planApiKeysLimitLabel}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(tenant.revenueLast30Days)}</TableCell>
                <TableCell>
                  {tenant.lastActivityAt ? formatDate(tenant.lastActivityAt) : t("enterprise.table.noActivity")}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/platform/tenants/${tenant.id}`}>
                      {t("enterprise.table.manage")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          page={safePage}
          pageSize={pageSize}
          totalItems={filteredTenants.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          labels={
            language === "ur"
              ? {
                  showing: "دکھایا جا رہا ہے",
                  of: "میں سے",
                  rowsPerPage: "قطاریں",
                  page: "صفحہ",
                  previous: "پچھلا",
                  next: "اگلا",
                }
              : {
                  showing: "Showing",
                  of: "of",
                  rowsPerPage: "Rows",
                  page: "Page",
                  previous: "Previous",
                  next: "Next",
                }
          }
        />

        {filteredTenants.length === 0 && (
          <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t("enterprise.table.noFilterMatch")}
          </div>
        )}
      </div>
    </div>
  );
}
