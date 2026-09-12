"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";

interface ExportSnapshotRow {
  id: string;
  organizationId: string;
  organizationName: string;
  actorEmail: string;
  createdAt: string | Date;
  rowCount: number;
  contentSha256: string;
  signature: string;
  generatedAtIso: string;
  scope: "GLOBAL" | "TENANT";
  tenantIdFilter: string | null;
  actionFilter: string | null;
  daysFilter: number | null;
  queryFilter: string | null;
  limitUsed: number;
  verificationStatus: "VALID" | "INVALID";
  verificationError: string | null;
}

function compact(value: string, head: number = 10, tail: number = 8) {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function snapshotMatchesQuery(snapshot: ExportSnapshotRow, normalizedQuery: string) {
  if (normalizedQuery.length === 0) return true;

  return (
    snapshot.organizationName.toLowerCase().includes(normalizedQuery) ||
    snapshot.actorEmail.toLowerCase().includes(normalizedQuery) ||
    snapshot.contentSha256.toLowerCase().includes(normalizedQuery) ||
    snapshot.signature.toLowerCase().includes(normalizedQuery) ||
    (snapshot.actionFilter || "").toLowerCase().includes(normalizedQuery) ||
    (snapshot.queryFilter || "").toLowerCase().includes(normalizedQuery)
  );
}

export function EnterpriseAuditExportSnapshots({
  snapshots,
}: {
  snapshots: ExportSnapshotRow[];
}) {
  const { t, language } = useI18n();
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"ALL" | "GLOBAL" | "TENANT">("ALL");
  const [verificationFilter, setVerificationFilter] = useState<"ALL" | "VALID" | "INVALID">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const labels =
    language === "ur"
      ? {
          allScope: "تمام اسکوپ",
          allVerification: "تمام تصدیق",
        }
      : {
          allScope: "All Scope",
          allVerification: "All Verification",
        };

  const filteredSnapshots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return snapshots.filter((snapshot) => {
      const queryMatch = snapshotMatchesQuery(snapshot, normalizedQuery);
      const scopeMatch = scopeFilter === "ALL" || snapshot.scope === scopeFilter;
      const verificationMatch =
        verificationFilter === "ALL" || snapshot.verificationStatus === verificationFilter;

      return queryMatch && scopeMatch && verificationMatch;
    });
  }, [snapshots, query, scopeFilter, verificationFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSnapshots.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedSnapshots = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSnapshots.slice(start, start + pageSize);
  }, [filteredSnapshots, safePage, pageSize]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("enterprise.audit.searchSnapshots")}
            className="pl-9"
          />
        </div>

        <Select
          value={scopeFilter}
          onValueChange={(value) => {
            setScopeFilter(value as typeof scopeFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder={t("enterprise.common.scope")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{labels.allScope}</SelectItem>
            <SelectItem value="GLOBAL">{t("enterprise.audit.scopeGlobal")}</SelectItem>
            <SelectItem value="TENANT">{t("enterprise.audit.scopeTenant")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={verificationFilter}
          onValueChange={(value) => {
            setVerificationFilter(value as typeof verificationFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder={t("enterprise.audit.columns.verification")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{labels.allVerification}</SelectItem>
            <SelectItem value="VALID">{t("enterprise.audit.verified")}</SelectItem>
            <SelectItem value="INVALID">{t("enterprise.audit.invalid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-zinc-500">
        {t("enterprise.audit.showingSnapshots", {
          filtered: filteredSnapshots.length,
          total: snapshots.length,
        })}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("enterprise.audit.columns.created")}</TableHead>
            <TableHead>{t("enterprise.audit.columns.verification")}</TableHead>
            <TableHead>{t("enterprise.common.scope")}</TableHead>
            <TableHead>{t("enterprise.common.tenant")}</TableHead>
            <TableHead>{t("enterprise.common.actor")}</TableHead>
            <TableHead className="text-right">{t("enterprise.common.rows")}</TableHead>
            <TableHead>{t("enterprise.audit.columns.sha")}</TableHead>
            <TableHead>{t("enterprise.audit.columns.signature")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSnapshots.map((snapshot) => (
            <TableRow key={snapshot.id}>
              <TableCell>
                <div>
                  <p>{formatDate(snapshot.createdAt)}</p>
                  <p className="text-xs text-zinc-500">{t("enterprise.audit.generated", { date: formatDate(snapshot.generatedAtIso) })}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <Badge variant={snapshot.verificationStatus === "VALID" ? "success" : "destructive"}>
                    {snapshot.verificationStatus === "VALID" ? t("enterprise.audit.verified") : t("enterprise.audit.invalid")}
                  </Badge>
                  {snapshot.verificationError && (
                    <p className="text-xs text-zinc-500">{snapshot.verificationError}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {snapshot.scope === "GLOBAL" ? (
                  <Badge variant="secondary">{t("enterprise.audit.scopeGlobal")}</Badge>
                ) : (
                  <Badge variant="default">{t("enterprise.audit.scopeTenant")}</Badge>
                )}
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{snapshot.organizationName}</p>
                  <p className="text-xs text-zinc-500">{snapshot.organizationId}</p>
                </div>
              </TableCell>
              <TableCell>{snapshot.actorEmail}</TableCell>
              <TableCell className="text-right">
                {formatNumber(snapshot.rowCount)}
                <p className="text-xs text-zinc-500">{t("enterprise.audit.columns.limit", { limit: formatNumber(snapshot.limitUsed) })}</p>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs" title={snapshot.contentSha256}>
                  {snapshot.contentSha256 ? compact(snapshot.contentSha256) : "-"}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs" title={snapshot.signature}>
                  {snapshot.signature ? compact(snapshot.signature) : "-"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TablePagination
        page={safePage}
        pageSize={pageSize}
        totalItems={filteredSnapshots.length}
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

      {filteredSnapshots.length === 0 && (
        <p className="pt-2 text-sm text-zinc-500">{t("enterprise.audit.noSnapshots")}</p>
      )}
    </div>
  );
}
