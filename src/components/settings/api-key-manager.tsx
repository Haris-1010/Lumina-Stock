"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Search, Trash2 } from "lucide-react";
import { createApiKey, revokeApiKey, type ApiKeyListItem } from "@/lib/actions/api-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { useI18n } from "@/components/providers/i18n-provider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDate(value: Date | null, locale: string, neverLabel: string) {
  if (!value) return neverLabel;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ApiKeyManager({ apiKeys }: { apiKeys: ApiKeyListItem[] }) {
  const router = useRouter();
  const { t, language } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [latestKey, setLatestKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const hasKeys = useMemo(() => apiKeys.length > 0, [apiKeys.length]);

  const filteredKeys = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return apiKeys.filter((key) => {
      const expired = Boolean(key.expiresAt && new Date(key.expiresAt) <= new Date());
      const queryMatch =
        normalizedQuery.length === 0 ||
        key.name.toLowerCase().includes(normalizedQuery) ||
        key.keyPrefix.toLowerCase().includes(normalizedQuery);

      const statusMatch =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && !expired) ||
        (statusFilter === "EXPIRED" && expired);

      return queryMatch && statusMatch;
    });
  }, [apiKeys, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredKeys.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedKeys = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredKeys.slice(start, start + pageSize);
  }, [filteredKeys, safePage, pageSize]);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("expiresInDays", expiresInDays);

      const result = await createApiKey(formData);
      if (result.error) {
        setError(result.error);
        return;
      }

      setLatestKey(result.apiKey ?? null);
      setName("");
      setExpiresInDays("");
      router.refresh();
    });
  }

  function handleRevoke(keyId: string) {
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("keyId", keyId);

      const result = await revokeApiKey(formData);
      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  async function handleCopy() {
    if (!latestKey) return;
    await navigator.clipboard.writeText(latestKey);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="grid gap-4 rounded-lg border border-zinc-200 p-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="api-key-name">{t("apiKeys.keyName")}</Label>
          <Input
            id="api-key-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("apiKeys.keyNamePlaceholder")}
            required
            maxLength={60}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key-expiry">{t("apiKeys.expiresInDays")}</Label>
          <Input
            id="api-key-expiry"
            type="number"
            min={1}
            max={3650}
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(event.target.value)}
            placeholder={t("apiKeys.expiresPlaceholder")}
          />
        </div>

        <Button type="submit" disabled={isPending}>
          <KeyRound className="h-4 w-4" />
          {isPending ? t("apiKeys.creating") : t("apiKeys.createButton")}
        </Button>
      </form>

      {latestKey && (
        <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            {t("apiKeys.saveNow")}
          </p>
          <div className="overflow-x-auto rounded-md bg-emerald-100/70 p-3 font-mono text-xs text-emerald-950">
            {latestKey}
          </div>
          <Button type="button" variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
            {copied ? t("apiKeys.copied") : t("apiKeys.copyKey")}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!hasKeys ? (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {t("apiKeys.none")}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={language === "ur" ? "نام یا پری فکس سے تلاش کریں" : "Search by name or key prefix"}
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as typeof statusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={t("apiKeys.table.status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{language === "ur" ? "تمام اسٹیٹس" : "All Status"}</SelectItem>
                <SelectItem value="ACTIVE">{t("apiKeys.status.active")}</SelectItem>
                <SelectItem value="EXPIRED">{t("apiKeys.status.expired")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("apiKeys.table.name")}</TableHead>
                <TableHead>{t("apiKeys.table.prefix")}</TableHead>
                <TableHead>{t("apiKeys.table.created")}</TableHead>
                <TableHead>{t("apiKeys.table.lastUsed")}</TableHead>
                <TableHead>{t("apiKeys.table.expires")}</TableHead>
                <TableHead>{t("apiKeys.table.status")}</TableHead>
                <TableHead className="text-right">{t("apiKeys.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedKeys.map((key) => {
                const expired = Boolean(key.expiresAt && new Date(key.expiresAt) <= new Date());
                const locale = language === "ur" ? "ur-PK" : "en-US";

                return (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs">{key.keyPrefix}...</TableCell>
                    <TableCell>{formatDate(key.createdAt, locale, t("apiKeys.never"))}</TableCell>
                    <TableCell>{formatDate(key.lastUsedAt, locale, t("apiKeys.never"))}</TableCell>
                    <TableCell>{key.expiresAt ? formatDate(key.expiresAt, locale, t("apiKeys.never")) : t("apiKeys.noExpiry")}</TableCell>
                    <TableCell>
                      {expired ? <Badge variant="warning">{t("apiKeys.status.expired")}</Badge> : <Badge variant="success">{t("apiKeys.status.active")}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleRevoke(key.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("apiKeys.revoke")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <TablePagination
            page={safePage}
            pageSize={pageSize}
            totalItems={filteredKeys.length}
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

          {filteredKeys.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {language === "ur" ? "کوئی API key فلٹر کے مطابق نہیں ملی۔" : "No API keys match your filters."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
