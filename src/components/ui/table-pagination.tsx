"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TablePaginationLabels {
  showing: string;
  of: string;
  rowsPerPage: string;
  page: string;
  previous: string;
  next: string;
}

interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  labels: TablePaginationLabels;
  pageSizeOptions?: number[];
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  labels,
  pageSizeOptions = [10, 20, 50],
}: TablePaginationProps) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(totalItems, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-3 py-3 text-sm dark:border-zinc-700">
      <p className="text-zinc-500 dark:text-zinc-400">
        {labels.showing} {start}-{end} {labels.of} {totalItems}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <span>{labels.rowsPerPage}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[84px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-zinc-500 dark:text-zinc-400">
          {labels.page} {page}/{totalPages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          {labels.previous}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          {labels.next}
        </Button>
      </div>
    </div>
  );
}
