"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { DomainPerformance } from "@/lib/data";

type SortField = "domain" | "totalEmails" | "avgWarmupScore" | "avgReplyRate" | "avgBounceRate";
type SortDir = "asc" | "desc";

interface Props {
  domains: DomainPerformance[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  loading: boolean;
  selectedDomains: Set<string>;
  onSelectionChange: (domains: Set<string>) => void;
  sortBy: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  page: number;
  onPageChange: (page: number) => void;
}

function RateBar({ rate, thresholds }: { rate: number; thresholds: { green: number; blue: number; amber: number } }) {
  const getColor = () => {
    if (rate >= thresholds.green) return "bg-emerald-500";
    if (rate >= thresholds.blue) return "bg-blue-500";
    if (rate >= thresholds.amber) return "bg-amber-500";
    return "bg-red-500";
  };
  const getTextColor = () => {
    if (rate >= thresholds.green) return "text-emerald-600 dark:text-emerald-400";
    if (rate >= thresholds.blue) return "text-blue-600 dark:text-blue-400";
    if (rate >= thresholds.amber) return "text-amber-600 dark:text-amber-400";
    return "text-red-500";
  };
  return (
    <div className="flex items-center gap-2.5 min-w-25">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${getColor()} transition-all duration-500`}
          style={{ width: `${Math.min(rate * 2, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${getTextColor()}`}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function WarmupBar({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 70) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
  };
  const getTextColor = () => {
    if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-500";
  };
  return (
    <div className="flex items-center gap-2.5 min-w-25">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${getColor()} transition-all duration-500`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${getTextColor()}`}>
        {score.toFixed(0)}
      </span>
    </div>
  );
}

function SortIcon({ field, sortBy, sortDir }: { field: SortField; sortBy: SortField | null; sortDir: SortDir }) {
  if (sortBy !== field) return <ArrowUpDown className="size-3 text-muted-foreground/40" />;
  return sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}

function smartPages(current: number, last: number): (number | "...")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  const add = new Set<number>();
  for (const p of [1, 2, current - 1, current, current + 1, last - 1, last]) {
    if (p >= 1 && p <= last) add.add(p);
  }
  const sorted = [...add].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) pages.push("...");
    pages.push(sorted[i]);
  }
  return pages;
}

export function DomainAnalyzerTable({
  domains,
  meta,
  loading,
  selectedDomains,
  onSelectionChange,
  sortBy,
  sortDir,
  onSort,
  page,
  onPageChange,
}: Props) {
  const allPageDomains = domains.map((d) => d.domain);
  const allSelected = allPageDomains.length > 0 && allPageDomains.every((d) => selectedDomains.has(d));
  const someSelected = allPageDomains.some((d) => selectedDomains.has(d)) && !allSelected;

  function toggleAll() {
    const next = new Set(selectedDomains);
    if (allSelected) {
      allPageDomains.forEach((d) => next.delete(d));
    } else {
      allPageDomains.forEach((d) => next.add(d));
    }
    onSelectionChange(next);
  }

  function toggleOne(domain: string) {
    const next = new Set(selectedDomains);
    if (next.has(domain)) next.delete(domain);
    else next.add(domain);
    onSelectionChange(next);
  }

  const columns: { label: string; field: SortField | null }[] = [
    { label: "Domain", field: "domain" },
    { label: "Total Emails", field: "totalEmails" },
    { label: "Avg Warmup Score", field: "avgWarmupScore" },
    { label: "Avg Reply Rate", field: "avgReplyRate" },
    { label: "Avg Bounce Rate", field: "avgBounceRate" },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.label}
                  className={col.field ? "cursor-pointer select-none whitespace-nowrap" : "whitespace-nowrap"}
                  onClick={() => col.field && onSort(col.field)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    {col.field && <SortIcon field={col.field} sortBy={sortBy} sortDir={sortDir} />}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.label}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : domains.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-10 text-muted-foreground">
                  No domains found. Try syncing data first.
                </TableCell>
              </TableRow>
            ) : (
              domains.map((d) => (
                <TableRow
                  key={d.domain}
                  data-state={selectedDomains.has(d.domain) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedDomains.has(d.domain)}
                      onCheckedChange={() => toggleOne(d.domain)}
                      aria-label={`Select ${d.domain}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-sm">{d.domain}</TableCell>
                  <TableCell className="tabular-nums text-sm">{d.totalEmails}</TableCell>
                  <TableCell><WarmupBar score={d.avgWarmupScore} /></TableCell>
                  <TableCell><RateBar rate={d.avgReplyRate} thresholds={{ green: 14, blue: 10, amber: 6 }} /></TableCell>
                  <TableCell><RateBar rate={d.avgBounceRate} thresholds={{ green: 0, blue: 0, amber: 3 }} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {meta.total} domain{meta.total !== 1 ? "s" : ""} total
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {smartPages(page, meta.last_page).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-1">...</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "ghost"}
                  size="icon"
                  className="size-8 text-xs"
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={page >= meta.last_page}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
