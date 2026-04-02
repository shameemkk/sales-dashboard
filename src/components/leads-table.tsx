"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Eye,
  Copy,
  Phone,
  Mail,
  Clock,
  Tag,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  Building2,
  CalendarIcon,
  MessageSquare,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { Lead } from "@/lib/data";

/* ─── Types ─── */
interface Stats {
  avgSpeedToDial: number | null;
  avgSpeedToText: number | null;
}

interface Meta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

type SortField = "dateAdded" | "name" | "email" | "firstDialTime" | "firstTextTime";
type SortDirection = "asc" | "desc";

/* ─── Constants ─── */
const GHL_LOCATION_ID = "2euS49kV93yDVpJrKvZi";
const GHL_BASE = `https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}`;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function contactUrl(id: string): string {
  return `${GHL_BASE}/contacts/detail/${id}`;
}

function opportunityUrl(opportunityId: string): string {
  return `${GHL_BASE}/opportunities/list/${opportunityId}?tab=Opportunity+Details`;
}

/* ─── Helpers ─── */
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapLead(item: any): Lead {
  const rawTags: any[] = Array.isArray(item.tags) ? item.tags : [];
  const tags: string[] = rawTags.map((t: any) =>
    typeof t === "string" ? t : String(t)
  );
  return {
    id: item.id as string,
    firstName: item.first_name ?? null,
    lastName: item.last_name ?? null,
    companyName: item.company_name ?? null,
    email: item.email ?? null,
    phone: item.phone ?? null,
    tags,
    dateAdded: item.date_added ?? null,
    notes: item.notes ?? null,
    opportunityId: item.opportunity_id ?? null,
    syncedAt: item.synced_at ?? null,
    enriched: item.enriched ?? false,
    firstDialTime: item.first_dial_time ?? null,
    firstTextTime: item.first_text_time ?? null,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFullDate(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso)} at ${formatTime(iso)}`;
}

function minutesBetween(from: string | null, to: string | null): { text: string; minutes: number | null } {
  if (!from || !to) return { text: "—", minutes: null };
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return { text: "—", minutes: null };
  const mins = Math.round(ms / 60000);
  if (mins < 60) return { text: `${mins}m`, minutes: mins };
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return { text: `${hours}h ${remainMins}m`, minutes: mins };
}

function getTimeBadgeColor(minutes: number | null): string {
  if (minutes === null) return "";
  if (minutes <= 5) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (minutes <= 15) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
}

function getPageNumbers(current: number, last: number): (number | "...")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < last - 1) pages.push("...");
  pages.push(last);
  return pages;
}

function leadName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
}

function leadInitials(lead: Lead): string {
  const f = lead.firstName?.[0] ?? "";
  const l = lead.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

/* ─── Sort (client-side within page) ─── */
function sortLeads(leads: Lead[], field: SortField, dir: SortDirection): Lead[] {
  const sorted = [...leads];
  const mult = dir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    let va: string | null;
    let vb: string | null;
    switch (field) {
      case "dateAdded":
        va = a.dateAdded;
        vb = b.dateAdded;
        break;
      case "name":
        va = leadName(a);
        vb = leadName(b);
        break;
      case "email":
        va = a.email;
        vb = b.email;
        break;
      case "firstDialTime":
        va = a.firstDialTime;
        vb = b.firstDialTime;
        break;
      case "firstTextTime":
        va = a.firstTextTime;
        vb = b.firstTextTime;
        break;
    }
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return va.localeCompare(vb) * mult;
  });
  return sorted;
}

/* ─── Sortable Header ─── */
function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  className = "",
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = currentField === field;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded text-xs font-medium"
      >
        {label}
        {active ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

/* ─── Lead Detail Dialog ─── */
function LeadDetailDialog({
  lead,
  open,
  onClose,
}: {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!lead) return null;

  const dialInfo = minutesBetween(lead.dateAdded, lead.firstDialTime);
  const textInfo = minutesBetween(lead.dateAdded, lead.firstTextTime);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {leadInitials(lead)}
            </div>
            <span className="text-lg">{leadName(lead)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DetailField icon={Mail} label="Email" value={lead.email} copyable />
            <DetailField icon={Phone} label="Phone" value={lead.phone} copyable />
            <DetailField icon={Building2} label="Company" value={lead.companyName} />
            <DetailField icon={Clock} label="Date Added" value={formatFullDate(lead.dateAdded)} />
            <DetailField icon={Tag} label="Tags" value={lead.tags.length > 0 ? lead.tags.join(", ") : null} />
          </div>

          {/* Response times */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Response Times</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">First Dial</p>
                <p className="text-sm font-medium">{formatFullDate(lead.firstDialTime)}</p>
                {dialInfo.minutes !== null && (
                  <Badge variant="outline" className={`mt-1 text-xs ${getTimeBadgeColor(dialInfo.minutes)}`}>
                    {dialInfo.text} after lead
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">First Text</p>
                <p className="text-sm font-medium">{formatFullDate(lead.firstTextTime)}</p>
                {textInfo.minutes !== null && (
                  <Badge variant="outline" className={`mt-1 text-xs ${getTimeBadgeColor(textInfo.minutes)}`}>
                    {textInfo.text} after lead
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}

          {/* External links */}
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <a href={contactUrl(lead.id)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5 mr-1.5" />
                View in GHL
              </a>
            </Button>
            {lead.opportunityId && (
              <Button variant="outline" size="sm" asChild>
                <a href={opportunityUrl(lead.opportunityId)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Opportunity
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  copyable,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          <p className="text-sm truncate">{value ?? "—"}</p>
          {copyable && value && (
            <button
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copy"
            >
              {copied ? (
                <CheckCircle2 className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stats, setStats] = useState<Stats>({ avgSpeedToDial: null, avgSpeedToText: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("dateAdded");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [contactSyncing, setContactSyncing] = useState(false);
  const [contactSyncResult, setContactSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const contactSyncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search) params.set("search", search);
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      params.set("dateFrom", from.toISOString());
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      params.set("dateTo", to.toISOString());
    }

    fetch(`/api/leads?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setLeads((json.data ?? []).map(mapLead));
        setMeta(json.meta ?? null);
        setStats(json.stats ?? { avgSpeedToDial: null, avgSpeedToText: null });
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search, dateRange]);

  // Scroll to top of table on page change
  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("desc");
      return field;
    });
  }, []);

  const startContactSyncPoll = useCallback(() => {
    if (contactSyncPollRef.current) clearInterval(contactSyncPollRef.current);
    contactSyncPollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/contact-sync");
        const s = await r.json();
        if (s.status === "completed") {
          clearInterval(contactSyncPollRef.current!);
          contactSyncPollRef.current = null;
          setContactSyncing(false);
          const e = s.contactsEnriched ? `, enriched ${s.contactsEnriched}` : "";
          setContactSyncResult({ ok: true, message: `Synced ${s.contactsUpserted ?? 0} contacts${e}` });
        } else if (s.status === "failed") {
          clearInterval(contactSyncPollRef.current!);
          contactSyncPollRef.current = null;
          setContactSyncing(false);
          setContactSyncResult({ ok: false, message: s.error ?? "Contact sync failed" });
        }
      } catch { /* ignore */ }
    }, 3000);
  }, []);

  useEffect(() => {
    return () => { if (contactSyncPollRef.current) clearInterval(contactSyncPollRef.current); };
  }, []);

  const handleContactSync = useCallback(async () => {
    setContactSyncing(true);
    setContactSyncResult(null);
    try {
      const res = await fetch("/api/contact-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Contact sync failed");
      startContactSyncPoll();
    } catch (err) {
      setContactSyncing(false);
      setContactSyncResult({ ok: false, message: err instanceof Error ? err.message : "Contact sync failed" });
    }
  }, [startContactSyncPoll]);

  // Collect unique tags for filter
  const allTags = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [leads]);

  // Apply client-side sort + tag filter
  const displayedLeads = useMemo(() => {
    let result = leads;
    if (tagFilter !== "all") {
      result = result.filter((l) => l.tags.includes(tagFilter));
    }
    return sortLeads(result, sortField, sortDir);
  }, [leads, sortField, sortDir, tagFilter]);

  const total = meta?.total ?? 0;
  const lastPage = meta?.last_page ?? 1;
  const perPage = meta?.per_page ?? pageSize;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const handleCopyValue = useCallback((value: string) => {
    navigator.clipboard.writeText(value);
  }, []);

  return (
    <>
      <LeadDetailDialog
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />

      <Card className="overflow-hidden">
        {/* Header */}
        <CardHeader className="px-2 pb-2 space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Users className="size-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Leads</CardTitle>
                <CardDescription className="text-xs">
                  {loading ? (
                    <Skeleton className="h-3 w-40 mt-0.5" />
                  ) : (
                    <>
                      {total.toLocaleString()} lead{total !== 1 ? "s" : ""} synced from GoHighLevel
                    </>
                  )}
                </CardDescription>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sync Now */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleContactSync} disabled={contactSyncing} variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                    {contactSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    {contactSyncing ? "Syncing…" : "Sync Now"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {contactSyncResult
                    ? <span className={contactSyncResult.ok ? "text-emerald-400" : "text-red-400"}>{contactSyncResult.message}</span>
                    : "Sync recent contacts & enrich"}
                </TooltipContent>
              </Tooltip>

              {/* Date range picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 font-normal">
                    <CalendarIcon className="size-3.5 text-muted-foreground" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>{format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d, yyyy")}</>
                      ) : (
                        format(dateRange.from, "MMM d, yyyy")
                      )
                    ) : (
                      "Date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => { setDateRange(range); setPage(1); }}
                    numberOfMonths={2}
                    disabled={{ after: new Date() }}
                  />
                  {dateRange && (
                    <div className="border-t px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs w-full"
                        onClick={() => { setDateRange(undefined); setPage(1); }}
                      >
                        Clear dates
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Tag filter */}
              {allTags.length > 0 && (
                <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v); }}>
                  <SelectTrigger className="w-35 h-9 text-xs">
                    <Tag className="size-3 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="All tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tags</SelectItem>
                    {allTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone…"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
                {searchInput && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Average Speed Stats */}
          {(stats.avgSpeedToDial !== null || stats.avgSpeedToText !== null) && (
            <div className="flex items-center gap-3 pt-1">
              {stats.avgSpeedToDial !== null && (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">Avg Speed to Dial</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {stats.avgSpeedToDial < 60
                        ? `${stats.avgSpeedToDial}m`
                        : `${Math.floor(stats.avgSpeedToDial / 60)}h ${stats.avgSpeedToDial % 60}m`}
                    </p>
                  </div>
                </div>
              )}
              {stats.avgSpeedToText !== null && (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">Avg Speed to Text</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {stats.avgSpeedToText < 60
                        ? `${stats.avgSpeedToText}m`
                        : `${Math.floor(stats.avgSpeedToText / 60)}h ${stats.avgSpeedToText % 60}m`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <div ref={tableRef} className="overflow-auto max-h-[calc(100vh-220px)]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow className="hover:bg-transparent border-b-2">
                  <SortableHeader
                    label="Date Added"
                    field="dateAdded"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="min-w-30 pl-3"
                  />
                  <SortableHeader
                    label="Contact Name"
                    field="name"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Email"
                    field="email"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead className="min-w-30">
                    <span className="text-xs font-medium">Phone</span>
                  </TableHead>
                  <TableHead className="min-w-25">
                    <span className="text-xs font-medium">Tags</span>
                  </TableHead>
                  <SortableHeader
                    label="Time to Dial"
                    field="firstDialTime"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="min-w-28"
                  />
                  <SortableHeader
                    label="Time to Text"
                    field="firstTextTime"
                    currentField={sortField}
                    currentDir={sortDir}
                    onSort={handleSort}
                    className="min-w-28"
                  />
                  <TableHead className="w-12.5">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="size-7 rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-destructive">
                        <AlertCircle className="size-10 opacity-50" />
                        <div>
                          <p className="font-medium">Failed to load leads</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setError(null); setLoading(true); setPage(page); }}
                        >
                          Try again
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Search className="size-10 opacity-20" />
                        <div>
                          <p className="font-medium text-foreground">No leads found</p>
                          <p className="text-sm mt-0.5">
                            {search
                              ? "Try adjusting your search terms"
                              : "Sync leads from GoHighLevel in Settings"}
                          </p>
                        </div>
                        {search && (
                          <Button variant="outline" size="sm" onClick={clearSearch}>
                            Clear search
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedLeads.map((lead) => {
                    const dialInfo = minutesBetween(lead.dateAdded, lead.firstDialTime);
                    const textInfo = minutesBetween(lead.dateAdded, lead.firstTextTime);
                    const name = leadName(lead);

                    return (
                      <TableRow
                        key={lead.id}
                        className="group cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setSelectedLead(lead)}
                      >
                        {/* Date */}
                        <TableCell className="py-3 pl-3">
                          <div>
                            <p className="text-sm tabular-nums">{formatDate(lead.dateAdded)}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{formatTime(lead.dateAdded)}</p>
                          </div>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="py-3">
                          <p className="text-sm font-medium">{name}</p>
                          {lead.companyName && (
                            <p className="text-xs text-muted-foreground">{lead.companyName}</p>
                          )}
                        </TableCell>

                        {/* Email */}
                        <TableCell className="py-3">
                          <p className="text-sm">{lead.email ?? "—"}</p>
                        </TableCell>

                        {/* Phone */}
                        <TableCell className="py-3">
                          <p className="text-sm tabular-nums">{lead.phone ?? "—"}</p>
                        </TableCell>

                        {/* Tags */}
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {lead.tags.length > 0 ? (
                              <>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-5 font-normal"
                                >
                                  {lead.tags[0]}
                                </Badge>
                                {lead.tags.length > 1 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-5 font-normal cursor-default"
                                      >
                                        +{lead.tags.length - 1}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p className="text-xs">{lead.tags.slice(1).join(", ")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>

                        {/* Time to Dial */}
                        <TableCell className="py-3">
                          {dialInfo.minutes !== null ? (
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium px-2 py-0.5 ${getTimeBadgeColor(dialInfo.minutes)}`}
                            >
                              <Phone className="size-3 mr-1" />
                              {dialInfo.text}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Time to Text */}
                        <TableCell className="py-3">
                          {textInfo.minutes !== null ? (
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium px-2 py-0.5 ${getTimeBadgeColor(textInfo.minutes)}`}
                            >
                              <Mail className="size-3 mr-1" />
                              {textInfo.text}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}>
                                <Eye className="size-4 mr-2" />
                                View details
                              </DropdownMenuItem>
                              {lead.email && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyValue(lead.email!); }}>
                                  <Copy className="size-4 mr-2" />
                                  Copy email
                                </DropdownMenuItem>
                              )}
                              {lead.phone && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyValue(lead.phone!); }}>
                                  <Copy className="size-4 mr-2" />
                                  Copy phone
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <a
                                  href={contactUrl(lead.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="size-4 mr-2" />
                                  Open in GHL
                                </a>
                              </DropdownMenuItem>
                              {lead.opportunityId && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={opportunityUrl(lead.opportunityId)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="size-4 mr-2" />
                                    View opportunity
                                  </a>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer / Pagination */}
          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between border-t px-2 py-2 bg-muted/20">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
                </p>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                >
                  <SelectTrigger className="w-20 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {lastPage > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {getPageNumbers(page, lastPage).map((p, i) =>
                    p === "..." ? (
                      <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "ghost"}
                        size="icon"
                        className="size-7 text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
