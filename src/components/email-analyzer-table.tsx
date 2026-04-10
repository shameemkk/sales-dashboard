"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { EmailPerformance, Tag } from "@/lib/data";

type SortField = "email" | "domain" | "warmup_score" | "reply_rate" | "bounce_rate" | "total_sent";
type SortDir = "asc" | "desc";

interface Props {
  emails: EmailPerformance[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  loading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  sortBy: SortField | null;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  page: number;
  onPageChange: (page: number) => void;
}

/* ── Metric bars ────────────────────────────────────────────────── */
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

/* ── Main table ─────────────────────────────────────────────────── */
export function EmailAnalyzerTable({
  emails,
  meta,
  loading,
  selectedIds,
  onSelectionChange,
  sortBy,
  sortDir,
  onSort,
  page,
  onPageChange,
}: Props) {
  const [tagsDialogEmail, setTagsDialogEmail] = useState<EmailPerformance | null>(null);

  const allPageIds = emails.map((e) => e.senderId);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someSelected = allPageIds.some((id) => selectedIds.has(id)) && !allSelected;

  function toggleAll() {
    const next = new Set(selectedIds);
    if (allSelected) {
      allPageIds.forEach((id) => next.delete(id));
    } else {
      allPageIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  const columns: { label: string; field: SortField | null; className?: string }[] = [
    { label: "Email", field: "email" },
    { label: "Domain", field: "domain" },
    { label: "Warmup Score", field: "warmup_score" },
    { label: "Reply Rate", field: "reply_rate" },
    { label: "Bounce Rate", field: "bounce_rate" },
    { label: "Sent", field: "total_sent" },
    { label: "Tags", field: null },
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
            ) : emails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-10 text-muted-foreground">
                  No email accounts found. Try syncing data first.
                </TableCell>
              </TableRow>
            ) : (
              emails.map((email) => (
                <TableRow
                  key={email.senderId}
                  data-state={selectedIds.has(email.senderId) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(email.senderId)}
                      onCheckedChange={() => toggleOne(email.senderId)}
                      aria-label={`Select ${email.email}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-sm">{email.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{email.domain}</TableCell>
                  <TableCell><WarmupBar score={email.warmupScore} /></TableCell>
                  <TableCell><RateBar rate={email.replyRate} thresholds={{ green: 14, blue: 10, amber: 6 }} /></TableCell>
                  <TableCell><RateBar rate={email.bounceRate} thresholds={{ green: 0, blue: 0, amber: 3 }} /></TableCell>
                  <TableCell className="tabular-nums text-sm">{email.totalSent.toLocaleString()}</TableCell>
                  <TableCell>
                    {email.tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTagsDialogEmail(email)}
                        className="flex flex-wrap gap-1 rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none cursor-pointer"
                        aria-label={`View all tags for ${email.email}`}
                      >
                        {(email.tags as Tag[]).slice(0, 3).map((t) => (
                          <Badge key={t.id} variant="secondary" className="text-xs">{t.name}</Badge>
                        ))}
                        {email.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{email.tags.length - 3}</Badge>
                        )}
                      </button>
                    )}
                  </TableCell>
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
            {meta.total} email{meta.total !== 1 ? "s" : ""} total
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

      <Dialog
        open={tagsDialogEmail !== null}
        onOpenChange={(open) => {
          if (!open) setTagsDialogEmail(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate">{tagsDialogEmail?.email}</DialogTitle>
            <DialogDescription>
              {tagsDialogEmail?.tags.length ?? 0} tag
              {(tagsDialogEmail?.tags.length ?? 0) !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {tagsDialogEmail?.tags.map((t) => (
                <Badge key={t.id} variant="secondary" className="text-xs">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
