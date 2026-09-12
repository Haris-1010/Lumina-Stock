"use client";

import { useState, useEffect } from "react";
import { Clock, FileText, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getImportLogs } from "@/lib/actions/import-log";

interface ImportLogEntry {
  id: string;
  entityType: string;
  source: string;
  fileName: string | null;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  createdAt: Date;
}

interface ImportHistoryProps {
  entityType?: string;
  limit?: number;
}

export function ImportHistory({ entityType, limit = 10 }: ImportHistoryProps) {
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const data = await getImportLogs(entityType, limit);
        setLogs(data as ImportLogEntry[]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [entityType, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-500">Loading import history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 px-4 py-3">
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No imports yet</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Import history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">
        Recent Imports
      </h4>
      {logs.map((log) => {
        const hasErrors = log.errors > 0;
        const allSuccess = log.errors === 0 && log.created + log.updated > 0;

        return (
          <div
            key={log.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5"
          >
            {/* Status icon */}
            <div className="shrink-0">
              {hasErrors ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : allSuccess ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <FileText className="h-4 w-4 text-zinc-400" />
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {log.fileName ?? log.source.toUpperCase()}
                </span>
                <Badge variant="secondary" className="text-[9px] shrink-0">
                  {log.entityType}
                </Badge>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {log.created} created · {log.updated} updated · {log.errors} errors
                {log.skipped > 0 ? ` · ${log.skipped} skipped` : ""}
              </p>
            </div>

            {/* Date */}
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-zinc-400">
                {new Date(log.createdAt).toLocaleDateString()}
              </p>
              <p className="text-[9px] text-zinc-400">
                {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
