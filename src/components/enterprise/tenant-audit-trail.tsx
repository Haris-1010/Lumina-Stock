"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
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
import { formatDate } from "@/lib/utils";

interface TenantAuditEntry {
  id: string;
  action: string;
  details: string | null;
  actorEmail: string;
  createdAt: string | Date;
}

const DATE_WINDOW_OPTIONS = [
  { value: "ALL", labelKey: "enterprise.common.dateAllTime" },
  { value: "7", labelKey: "enterprise.common.date7" },
  { value: "30", labelKey: "enterprise.common.date30" },
  { value: "90", labelKey: "enterprise.common.date90" },
] as const;

type DateWindowValue = (typeof DATE_WINDOW_OPTIONS)[number]["value"];

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function csvEscape(value: string) {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  if (normalized.includes(",") || normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", filename);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TenantAuditTrail({
  entries,
  organizationId,
  referenceNowIso,
}: {
  entries: TenantAuditEntry[];
  organizationId: string;
  referenceNowIso: string;
}) {
  const { t, language } = useI18n();
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [dateWindow, setDateWindow] = useState<DateWindowValue>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const referenceNowMs = useMemo(() => new Date(referenceNowIso).getTime(), [referenceNowIso]);

  const actionOptions = useMemo(() => {
    const uniqueActions = Array.from(new Set(entries.map((entry) => entry.action)));
    return uniqueActions.sort((left, right) => left.localeCompare(right));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const dateWindowMs = dateWindow === "ALL" ? null : Number(dateWindow) * 24 * 60 * 60 * 1000;

    return entries.filter((entry) => {
      const matchesAction = actionFilter === "ALL" || entry.action === actionFilter;

      const matchesQuery =
        normalizedQuery.length === 0 ||
        entry.actorEmail.toLowerCase().includes(normalizedQuery) ||
        entry.action.toLowerCase().includes(normalizedQuery) ||
        (entry.details || "").toLowerCase().includes(normalizedQuery);

      const createdAtMs = toDate(entry.createdAt).getTime();
      const matchesDateWindow = dateWindowMs === null || referenceNowMs - createdAtMs <= dateWindowMs;

      return matchesAction && matchesQuery && matchesDateWindow;
    });
  }, [entries, actionFilter, query, dateWindow, referenceNowMs]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedEntries = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, safePage, pageSize]);

  function handleExportCsv() {
    const timestamp = new Date().toISOString().slice(0, 10);
    const rows = [
      ["when", "actor", "action", "details"],
      ...filteredEntries.map((entry) => [
        toDate(entry.createdAt).toISOString(),
        entry.actorEmail,
        entry.action,
        entry.details || "",
      ]),
    ];

    downloadCsv(`tenant-${organizationId}-audit-${timestamp}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("enterprise.auditTrail.search")}
            className="pl-9"
          />
        </div>

        <Select
          value={actionFilter}
          onValueChange={(value) => {
            setActionFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("enterprise.auditTrail.filterByAction")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("enterprise.auditTrail.allActions")}</SelectItem>
            {actionOptions.map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={dateWindow}
          onValueChange={(value) => {
            setDateWindow(value as DateWindowValue);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder={t("enterprise.auditTrail.dateRange")} />
          </SelectTrigger>
          <SelectContent>
            {DATE_WINDOW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={handleExportCsv} disabled={filteredEntries.length === 0}>
          <Download className="h-4 w-4" />
          {t("enterprise.auditTrail.exportCsv")}
        </Button>
      </div>

      <p className="text-xs text-zinc-500">
        {t("enterprise.auditTrail.showing", {
          filtered: filteredEntries.length,
          total: entries.length,
        })}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("enterprise.common.when")}</TableHead>
            <TableHead>{t("enterprise.common.actor")}</TableHead>
            <TableHead>{t("enterprise.common.action")}</TableHead>
            <TableHead>{t("enterprise.common.details")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedEntries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{formatDate(toDate(entry.createdAt))}</TableCell>
              <TableCell>{entry.actorEmail}</TableCell>
              <TableCell>{entry.action}</TableCell>
              <TableCell>{entry.details || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TablePagination
        page={safePage}
        pageSize={pageSize}
        totalItems={filteredEntries.length}
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

      {filteredEntries.length === 0 && (
        <p className="pt-2 text-sm text-zinc-500">{t("enterprise.auditTrail.noMatches")}</p>
      )}
    </div>
  );
}
