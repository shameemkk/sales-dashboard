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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame,
  Tag as TagIcon,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { Fragment } from "react";
import type { EmailAccount, Tag, AccountDailyStat } from "@/lib/data";
import type { TagFilterMode } from "@/components/account-overview";

type SortField =
  | "email"
  | "totalEmailsSent"
  | "totalReplies"
  | "replyRate"
  | "totalWarmupsSent"
  | "status";
type SortDir = "asc" | "desc";

interface ApiMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

type StatusFilter = "" | "connected" | "not_connected";

interface EmailAccountsTableProps {
  accounts: EmailAccount[];
  meta: ApiMeta | null;
  loading: boolean;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  tags: Tag[];
  tagsLoading: boolean;
  tagFilterMode: TagFilterMode;
  selectedTagIds: number[];
  onTagFilterModeChange: (mode: TagFilterMode) => void;
  onSelectedTagIdsChange: (ids: number[]) => void;
  statsMap: Map<string, AccountDailyStat[]>;
  statsLoading: boolean;
  statsStartDate: string;
  statsEndDate: string;
}

function getPageNumbers(current: number, last: number): (number | "...")[] {
  const delta = 2;
  const rangeSet = new Set<number>();
  // Always first 2 and last 2
  for (let i = 1; i <= Math.min(2, last); i++) rangeSet.add(i);
  for (let i = Math.max(last - 1, 1); i <= last; i++) rangeSet.add(i);
  // Window around current page
  for (let i = Math.max(1, current - delta); i <= Math.min(last, current + delta); i++) rangeSet.add(i);

  const sorted = Array.from(rangeSet).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

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
    <div className="flex items-center gap-2.5 min-w-25">
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

function SortIcon({
  field,
  sortBy,
  sortDir,
}: {
  field: SortField;
  sortBy: SortField | null;
  sortDir: SortDir;
}) {
  if (sortBy !== field)
    return <ArrowUpDown className="size-3 text-muted-foreground/40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

interface WarmupData {
  email?: string;
  warmup_emails_sent?: number;
  [key: string]: unknown;
}

function WarmupToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        on ? "bg-amber-500" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function WarmupCell({
  account,
}: {
  account: EmailAccount;
}) {
  const [warmupData, setWarmupData] = useState<WarmupData | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "done" | "error">("idle");

  function handleOpen(open: boolean) {
    if (!open || fetchState !== "idle") return;
    setFetchState("loading");
    fetch(`/api/warmup/${account.id}`)
      .then((r) => r.json())
      .then((data) => {
        setWarmupData(data);
        setFetchState("done");
      })
      .catch(() => setFetchState("error"));
  }

  return (
    <HoverCard openDelay={300} closeDelay={100} onOpenChange={handleOpen}>
      <HoverCardTrigger asChild>
        <div className="inline-flex cursor-default">
          <Badge
            variant="outline"
            className={
              account.warmupEnabled
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 cursor-pointer"
                : "bg-slate-500/10 text-slate-500 border-slate-500/20 cursor-pointer"
            }
          >
            {account.warmupEnabled ? "On" : "Off"}
          </Badge>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-0" side="top" align="center">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-sm font-semibold">Warmup Details</p>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* Email */}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
              Email
            </p>
            {fetchState === "loading" ? (
              <Skeleton className="h-3.5 w-40" />
            ) : (
              <p className="text-xs font-medium break-all">
                {warmupData?.email ?? account.email}
              </p>
            )}
          </div>

          {/* Warmup Emails Sent */}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
              Warmup Emails Sent
            </p>
            {fetchState === "loading" ? (
              <Skeleton className="h-3.5 w-16" />
            ) : fetchState === "error" ? (
              <p className="text-xs text-destructive">Failed to load</p>
            ) : (
              <p className="text-xl font-bold tabular-nums">
                {(warmupData?.warmup_emails_sent ?? 0).toLocaleString()}
              </p>
            )}
          </div>

          {/* Daily Limit */}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
              Daily Limit
            </p>
            <p className="text-xl font-bold tabular-nums">
              {(account.dailyLimit ?? 0).toLocaleString()}
            </p>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between pt-1 border-t">
            <p className="text-xs text-muted-foreground">Warmup enabled</p>
            <WarmupToggle enabled={account.warmupEnabled} />
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function EmailAccountsTable({
  accounts,
  meta,
  loading,
  searchInput,
  onSearchChange,
  onPageChange,
  statusFilter,
  onStatusChange,
  tags,
  tagsLoading,
  tagFilterMode,
  selectedTagIds,
  onTagFilterModeChange,
  onSelectedTagIdsChange,
  statsMap,
  statsLoading,
  statsStartDate,
  statsEndDate,
}: EmailAccountsTableProps) {
  const [sortBy, setSortBy] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tagSearch, setTagSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortDir("desc");
      }
    },
    [sortBy]
  );

  const sorted = useMemo(() => {
    if (!sortBy) return accounts;
    return [...accounts].sort((a, b) => {
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
  }, [accounts, sortBy, sortDir]);

  const sortableHeader = (label: string, field: SortField) => (
    <button
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      {label}
      <SortIcon field={field} sortBy={sortBy} sortDir={sortDir} />
    </button>
  );

  const currentPage = meta?.current_page ?? 1;
  const lastPage = meta?.last_page ?? 1;
  const total = meta?.total ?? accounts.length;

  const from = meta ? (currentPage - 1) * meta.per_page + 1 : 1;
  const to = meta ? Math.min(currentPage * meta.per_page, total) : accounts.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Email Accounts</CardTitle>
              <CardDescription>
                {loading ? "Loading…" : `${total.toLocaleString()} accounts total`}
              </CardDescription>
            </div>
          </div>

          {/* Toggle filters button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className="h-9 gap-1.5 text-xs"
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {(statusFilter !== "" || tagFilterMode !== "" || searchInput !== "") && (
              <span className="size-1.5 rounded-full bg-primary" />
            )}
            <ChevronDown
              className={`size-3 text-muted-foreground transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`}
            />
          </Button>
        </div>

        {/* Collapsible filter panel */}
        {showFilters && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-3 border-t">
              {/* Status filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                    Status:{" "}
                    <span className="font-semibold">
                      {statusFilter === "" ? "All" : statusFilter === "connected" ? "Active" : "Inactive"}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-36">
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={(v) => onStatusChange(v as StatusFilter)}
                  >
                    <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="connected">Active</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="not_connected">Inactive</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by email…"
                  value={searchInput}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Tag filter row */}
            <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <TagIcon className="size-3.5" />
            Tags:
          </div>

          {/* Mode toggle — "Contains tags" and "Do not contain tags" open inline dropdowns */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {/* Any */}
            <button
              onClick={() => onTagFilterModeChange("")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                tagFilterMode === ""
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Any
            </button>

            {/* Contains tags */}
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) onTagFilterModeChange("has_tags");
                else setTagSearch("");
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    tagFilterMode === "has_tags"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Contains tags
                  {tagFilterMode === "has_tags" && selectedTagIds.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                      {selectedTagIds.length}
                    </span>
                  )}
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 p-0">
                <div className="flex items-center border-b px-2">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    className="flex h-8 w-full bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
                    placeholder="Search tags…"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {tagsLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
                  ) : (() => {
                    const filtered = tags.filter((t) =>
                      t.name.toLowerCase().includes(tagSearch.toLowerCase())
                    );
                    return filtered.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No tags found</div>
                    ) : filtered.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={(checked) =>
                          onSelectedTagIdsChange(
                            checked
                              ? [...selectedTagIds, tag.id]
                              : selectedTagIds.filter((id) => id !== tag.id)
                          )
                        }
                      >
                        {tag.name}
                      </DropdownMenuCheckboxItem>
                    ));
                  })()}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* No tags */}
            <button
              onClick={() => onTagFilterModeChange("no_tags")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                tagFilterMode === "no_tags"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              No tags
            </button>

            {/* Do not contain tags */}
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) onTagFilterModeChange("exclude_tags");
                else setTagSearch("");
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    tagFilterMode === "exclude_tags"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Do not contain tags
                  {tagFilterMode === "exclude_tags" && selectedTagIds.length > 0 && (
                    <span className="rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">
                      {selectedTagIds.length}
                    </span>
                  )}
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 p-0">
                <div className="flex items-center border-b px-2">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    className="flex h-8 w-full bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
                    placeholder="Search tags…"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {tagsLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
                  ) : (() => {
                    const filtered = tags.filter((t) =>
                      t.name.toLowerCase().includes(tagSearch.toLowerCase())
                    );
                    return filtered.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No tags found</div>
                    ) : filtered.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={(checked) =>
                          onSelectedTagIdsChange(
                            checked
                              ? [...selectedTagIds, tag.id]
                              : selectedTagIds.filter((id) => id !== tag.id)
                          )
                        }
                      >
                        {tag.name}
                      </DropdownMenuCheckboxItem>
                    ));
                  })()}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Active tag badges */}
          {tagFilterMode === "has_tags" && selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.filter((t) => selectedTagIds.includes(t.id)).map((t) => (
                <Badge key={t.id} variant="outline" className="rounded-full px-2 py-0 text-[11px] bg-primary/5 border-primary/20 text-primary">
                  {t.name}
                </Badge>
              ))}
            </div>
          )}
          {tagFilterMode === "exclude_tags" && selectedTagIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.filter((t) => selectedTagIds.includes(t.id)).map((t) => (
                <Badge key={t.id} variant="outline" className="rounded-full px-2 py-0 text-[11px] bg-destructive/5 border-destructive/20 text-destructive">
                  {t.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 pl-4" />
              <TableHead className="pl-2">
                {sortableHeader("Email Account", "email")}
              </TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">
                {sortableHeader("Emails Sent", "totalEmailsSent")}
              </TableHead>
              <TableHead className="text-right">
                {sortableHeader("Replies", "totalReplies")}
              </TableHead>
              <TableHead className="text-right">
                {sortableHeader("Reply Rate", "replyRate")}
              </TableHead>
              <TableHead className="text-center">Warmup</TableHead>
              <TableHead className="text-center pr-6">
                {sortableHeader("Status", "status")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-4 w-10" />
                  <TableCell className="pl-2">
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-12 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </TableCell>
                  <TableCell className="text-center pr-6">
                    <Skeleton className="h-5 w-16 mx-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Search className="size-8 text-muted-foreground/30" />
                    <p>
                      {searchInput || statusFilter
                        ? "No accounts match your filters."
                        : "No accounts."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((account) => {
                const isExpanded = expandedId === account.id;
                const accountStats = statsMap.get(account.id) ?? [];
                return (
                  <Fragment key={account.id}>
                    <TableRow className="group hover:bg-muted/30 transition-colors">
                      {/* Expand toggle */}
                      <TableCell className="pl-4 w-10">
                        <button
                          onClick={() =>
                            setExpandedId((prev) =>
                              prev === account.id ? null : account.id
                            )
                          }
                          className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors"
                          aria-label={isExpanded ? "Collapse" : "Expand daily stats"}
                        >
                          <ChevronRight
                            className={`size-4 text-muted-foreground transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="pl-2 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary ring-1 ring-primary/10">
                            {account.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">{account.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {account.tags.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            account.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="rounded-full px-2 py-0 text-[11px] font-medium bg-primary/5 border-primary/20 text-primary"
                              >
                                {tag}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {(account.totalEmailsSent ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {(account.totalReplies ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <ReplyRateBar rate={account.replyRate} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <WarmupCell account={account} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <div className="flex justify-center">
                          <StatusBadge status={account.status} />
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable daily stats row */}
                    {isExpanded && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={8} className="p-0">
                          <DailyStatsPanel
                            stats={accountStats}
                            loading={statsLoading}
                            startDate={statsStartDate}
                            endDate={statsEndDate}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex flex-col gap-3 border-t px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">
            {loading
              ? "Loading…"
              : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={loading || currentPage <= 1}
              className="h-8 px-2"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {getPageNumbers(currentPage, lastPage).map((p, i) =>
              p === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  className="h-8 w-8 flex items-center justify-center text-sm text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === currentPage ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  disabled={loading}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={loading || currentPage >= lastPage}
              className="h-8 px-2"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Daily Stats Panel ────────────────────────────────────────────────────────

const STAT_COLS: { key: keyof AccountDailyStat; label: string }[] = [
  { key: "sent",         label: "Sent" },
  { key: "replied",      label: "Replied" },
  { key: "total_opens",  label: "Opens" },
  { key: "unique_opens", label: "Unique Opens" },
  { key: "interested",   label: "Interested" },
  { key: "unsubscribed", label: "Unsub" },
  { key: "bounced",      label: "Bounced" },
];

function DailyStatsPanel({
  stats,
  loading,
  startDate,
  endDate,
}: {
  stats: AccountDailyStat[];
  loading: boolean;
  startDate: string;
  endDate: string;
}) {
  if (loading) {
    return (
      <div className="px-8 py-4 space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="px-8 py-4 text-xs text-muted-foreground">
        No stats synced for {startDate === endDate ? startDate : `${startDate} – ${endDate}`}.
        Run a sync to populate data.
      </div>
    );
  }

  const isRange = startDate !== endDate;

  // Column totals (used for range summary row and single-date footer)
  const totals = STAT_COLS.reduce(
    (acc, { key }) => {
      acc[key] = stats.reduce((sum, row) => sum + ((row[key] as number) ?? 0), 0);
      return acc;
    },
    {} as Partial<Record<keyof AccountDailyStat, number>>
  );

  return (
    <div className="px-6 py-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="py-2 px-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                {isRange ? "Date Range" : "Date"}
              </th>
              {STAT_COLS.map(({ key, label }) => (
                <th
                  key={key}
                  className="py-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isRange ? (
              <tr className="border-b last:border-0">
                <td className="py-2 px-3 font-medium tabular-nums whitespace-nowrap">
                  {startDate} – {endDate}
                </td>
                {STAT_COLS.map(({ key }) => (
                  <td key={key} className="py-2 px-3 text-right tabular-nums">
                    {(totals[key] ?? 0).toLocaleString()}
                  </td>
                ))}
              </tr>
            ) : (
              stats.map((row, i) => (
                <tr key={`${row.stat_date}-${i}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3 font-medium tabular-nums whitespace-nowrap">
                    {row.stat_date}
                  </td>
                  {STAT_COLS.map(({ key }) => (
                    <td key={key} className="py-2 px-3 text-right tabular-nums">
                      {((row[key] as number) ?? 0).toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
