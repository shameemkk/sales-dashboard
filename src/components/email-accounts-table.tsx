"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { EmailAccount } from "@/lib/data";

const PAGE_SIZE = 5;

type SortField = "email" | "totalEmailsSent" | "totalReplies" | "replyRate" | "totalWarmupsSent" | "status";
type SortDir = "asc" | "desc";

function StatusBadge({ status }: { status: EmailAccount["status"] }) {
  const variants: Record<
    EmailAccount["status"],
    { label: string; className: string }
  > = {
    active: {
      label: "Active",
      className:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
    },
    inactive: {
      label: "Inactive",
      className:
        "bg-slate-500/10 text-slate-500 border-slate-500/20 hover:bg-slate-500/20",
    },
    warming: {
      label: "Warming",
      className:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
    },
  };
  const variant = variants[status];
  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

function ReplyRateBar({ rate }: { rate: number }) {
  const getColor = () => {
    if (rate >= 14) return "bg-emerald-500";
    if (rate >= 10) return "bg-blue-500";
    if (rate >= 6) return "bg-amber-500";
    return "bg-red-500";
  };

  const getTextColor = () => {
    if (rate >= 14) return "text-emerald-600 dark:text-emerald-400";
    if (rate >= 10) return "text-blue-600 dark:text-blue-400";
    if (rate >= 6) return "text-amber-600 dark:text-amber-400";
    return "text-red-500";
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${getColor()} transition-all duration-500`}
          style={{ width: `${Math.min(rate * 5, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${getTextColor()}`}>
        {rate.toFixed(1)}%
      </span>
    </div>
  );
}

function SortIcon({ field, sortBy, sortDir }: { field: SortField; sortBy: SortField | null; sortDir: SortDir }) {
  if (sortBy !== field)
    return <ArrowUpDown className="size-3 text-muted-foreground/40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

interface EmailAccountsTableProps {
  accounts: EmailAccount[];
}

export function EmailAccountsTable({ accounts }: EmailAccountsTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortDir("desc");
      }
      setPage(1);
    },
    [sortBy]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? accounts.filter((a) => a.email.toLowerCase().includes(q))
      : [...accounts];

    if (sortBy) {
      result.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "email") {
          cmp = a.email.localeCompare(b.email);
        } else if (sortBy === "status") {
          cmp = a.status.localeCompare(b.status);
        } else {
          cmp = (a[sortBy] as number) - (b[sortBy] as number);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [accounts, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageAccounts = useMemo(
    () => filtered.slice(start, start + PAGE_SIZE),
    [filtered, start]
  );

  const goToPage = (p: number) =>
    setPage(Math.max(1, Math.min(p, totalPages)));

  const sortableHeader = (label: string, field: SortField) => (
    <button
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      {label}
      <SortIcon field={field} sortBy={sortBy} sortDir={sortDir} />
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Email Accounts</CardTitle>
              <CardDescription>
                {filtered.length} account{filtered.length !== 1 ? "s" : ""}{" "}
                configured
                {search ? ` (filtered from ${accounts.length})` : ""}
              </CardDescription>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-6">
                {sortableHeader("Email Account", "email")}
              </TableHead>
              <TableHead className="text-right">
                {sortableHeader("Emails Sent", "totalEmailsSent")}
              </TableHead>
              <TableHead className="text-right">
                {sortableHeader("Replies", "totalReplies")}
              </TableHead>
              <TableHead className="text-right">
                {sortableHeader("Reply Rate", "replyRate")}
              </TableHead>
              <TableHead className="text-right">
                {sortableHeader("Warmups", "totalWarmupsSent")}
              </TableHead>
              <TableHead className="text-center pr-6">
                {sortableHeader("Status", "status")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageAccounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Search className="size-8 text-muted-foreground/30" />
                    <p>
                      {search
                        ? "No accounts match your search."
                        : "No accounts."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageAccounts.map((account) => (
                <TableRow
                  key={account.id}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="pl-6 font-medium">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary ring-1 ring-primary/10">
                        {account.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm">{account.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {account.totalEmailsSent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {account.totalReplies.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <ReplyRateBar rate={account.replyRate} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {account.totalWarmupsSent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center pr-6">
                    <div className="flex justify-center">
                      <StatusBadge status={account.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-6 py-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              Showing {start + 1}&ndash;
              {Math.min(start + PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="h-8"
              >
                <ChevronLeft className="size-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <Button
                      key={p}
                      variant={p === currentPage ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-8"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
