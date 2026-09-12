"use client";

import { useState, useCallback, useRef } from "react";

interface StreamProgress {
  phase: "parsing" | "validating" | "importing" | "complete" | "error";
  message?: string;
  processed?: number;
  total?: number;
  created?: number;
  updated?: number;
  errors?: number;
}

interface StreamImportResult {
  created: number;
  updated: number;
  errors: number;
  total: number;
}

/**
 * Hook for streaming file imports via SSE.
 * Shows real-time progress as rows are imported in chunks.
 */
export function useStreamImport() {
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startImport = useCallback(
    async (
      file: File,
      entityType: string,
      organizationId: string,
      userId: string,
      mappings?: string
    ): Promise<StreamImportResult | null> => {
      setIsStreaming(true);
      setProgress({ phase: "parsing", message: "Uploading file..." });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("organizationId", organizationId);
      formData.append("userId", userId);
      if (mappings) formData.append("mappings", mappings);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const res = await fetch("/api/import/stream", {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let result: StreamImportResult | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                setProgress(data);

                if (data.phase === "complete") {
                  result = {
                    created: data.created ?? 0,
                    updated: data.updated ?? 0,
                    errors: data.errors ?? 0,
                    total: data.total ?? 0,
                  };
                }

                if (data.phase === "error") {
                  throw new Error(data.message);
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        }

        return result;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setProgress(null);
          return null;
        }
        setProgress({ phase: "error", message: (err as Error).message });
        return null;
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { progress, isStreaming, startImport, cancel };
}
