"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Search, Mail, Globe, ChevronsUpDown, Check } from "lucide-react";
import { EmailAnalyzerTable } from "@/components/email-analyzer-table";
import { DomainAnalyzerTable } from "@/components/domain-analyzer-table";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { EmailAnalyzerFilterBar } from "@/components/email-analyzer-filter-bar";
import { EmailAnalyzerViews } from "@/components/email-analyzer-views";
import {
  DOMAIN_COLUMNS,
  EMAIL_COLUMNS,
  EMPTY_FILTERS,
  serializeFilters,
  type FilterState,
} from "@/lib/email-analyzer-filters";
import type {
  EmailPerformance,
  DomainPerformance,
  Workspace,
  Tag,
} from "@/lib/data";

type View = "email" | "domain";
type EmailSortField = "email" | "domain" | "warmup_score" | "reply_rate" | "bounce_rate" | "total_sent";
type DomainSortField = "domain" | "totalEmails" | "totalSent" | "avgWarmupScore" | "avgReplyRate" | "avgBounceRate";
type SortDir = "asc" | "desc";

const META_DEFAULT = { current_page: 1, last_page: 1, per_page: 25, total: 0 };

export function EmailAnalyzer() {
  // View toggle
  const [view, setView] = useState<View>("email");

  // Data
  const [emails, setEmails] = useState<EmailPerformance[]>([]);
  const [domains, setDomains] = useState<DomainPerformance[]>([]);
  const [emailMeta, setEmailMeta] = useState(META_DEFAULT);
  const [domainMeta, setDomainMeta] = useState(META_DEFAULT);
  const [loading, setLoading] = useState(false);

  // Filters
  const [workspaceId, setWorkspaceId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Advanced filters + saved views (per sub-view)
  const [emailFilters, setEmailFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [domainFilters, setDomainFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [activeEmailViewId, setActiveEmailViewId] = useState<string | null>(null);
  const [activeDomainViewId, setActiveDomainViewId] = useState<string | null>(null);

  // Sorting
  const [emailSort, setEmailSort] = useState<{ by: EmailSortField | null; dir: SortDir }>({ by: null, dir: "asc" });
  const [domainSort, setDomainSort] = useState<{ by: DomainSortField | null; dir: SortDir }>({ by: null, dir: "asc" });

  // Pagination
  const [emailPage, setEmailPage] = useState(1);
  const [domainPage, setDomainPage] = useState(1);

  // Selection
  const [selectedSenderIds, setSelectedSenderIds] = useState<Set<string>>(new Set());
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Reference data
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [imapServers, setImapServers] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  // Workspace search popover
  const [wsOpen, setWsOpen] = useState(false);
  const [wsSearch, setWsSearch] = useState("");

  // Domain-to-senderIds mapping (for domain selection → tag operations)
  const [domainEmailMap, setDomainEmailMap] = useState<Map<string, string[]>>(new Map());

  // Filtered workspaces for search
  const filteredWorkspaces = useMemo(() => {
    if (!wsSearch) return workspaces;
    const q = wsSearch.toLowerCase();
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(q));
  }, [workspaces, wsSearch]);

  const selectedWsName = useMemo(() => {
    if (!workspaceId) return "All Workspaces";
    return workspaces.find((ws) => ws.id === workspaceId)?.name ?? "All Workspaces";
  }, [workspaceId, workspaces]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setEmailPage(1); }, [workspaceId, debouncedSearch, emailFilters]);
  useEffect(() => { setDomainPage(1); }, [workspaceId, debouncedSearch, domainFilters]);

  // Fetch workspaces + tags on mount
  useEffect(() => {
    fetch("/api/workspaces?limit=50")
      .then((r) => r.json())
      .then((d) => setWorkspaces(d.workspaces ?? []))
      .catch(() => {});

    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setTags(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => {});

    fetch("/api/email-analyzer/imap-servers")
      .then((r) => r.json())
      .then((d) => setImapServers(Array.isArray(d.data) ? d.data : []))
      .catch(() => {});

    fetch("/api/email-analyzer/statuses")
      .then((r) => r.json())
      .then((d) => setStatuses(Array.isArray(d.data) ? d.data : []))
      .catch(() => {});
  }, []);

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(emailPage));
      params.set("limit", "25");
      if (workspaceId) params.set("workspace_id", workspaceId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (emailSort.by) {
        params.set("sort_by", emailSort.by);
        params.set("sort_dir", emailSort.dir);
      }
      for (const [k, v] of serializeFilters(emailFilters, EMAIL_COLUMNS)) {
        params.append(k, v);
      }

      const res = await fetch(`/api/email-analyzer/emails?${params}`);
      const json = await res.json();
      setEmails(json.data ?? []);
      setEmailMeta(json.meta ?? META_DEFAULT);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, [emailPage, workspaceId, debouncedSearch, emailSort, emailFilters]);

  // Fetch domains
  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(domainPage));
      params.set("limit", "25");
      if (workspaceId) params.set("workspace_id", workspaceId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (domainSort.by) {
        params.set("sort_by", domainSort.by);
        params.set("sort_dir", domainSort.dir);
      }
      for (const [k, v] of serializeFilters(domainFilters, DOMAIN_COLUMNS)) {
        params.append(k, v);
      }

      const res = await fetch(`/api/email-analyzer/domains?${params}`);
      const json = await res.json();
      setDomains(json.data ?? []);
      setDomainMeta(json.meta ?? META_DEFAULT);
    } catch {
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [domainPage, workspaceId, debouncedSearch, domainSort, domainFilters]);

  // Build domain → senderIds map when emails load
  const fetchDomainEmailMapping = useCallback(async () => {
    try {
      // Fetch all emails (no pagination) for the domain mapping
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (workspaceId) params.set("workspace_id", workspaceId);

      const res = await fetch(`/api/email-analyzer/emails?${params}`);
      const json = await res.json();
      const allEmails: EmailPerformance[] = json.data ?? [];

      const map = new Map<string, string[]>();
      for (const e of allEmails) {
        const list = map.get(e.domain) ?? [];
        list.push(e.senderId);
        map.set(e.domain, list);
      }
      setDomainEmailMap(map);
    } catch {
      // ignore
    }
  }, [workspaceId]);

  // Fetch data on view/filter change
  useEffect(() => {
    if (view === "email") fetchEmails();
    else fetchDomains();
  }, [view, fetchEmails, fetchDomains]);

  // Load domain mapping when switching to domain view
  useEffect(() => {
    if (view === "domain") fetchDomainEmailMapping();
  }, [view, fetchDomainEmailMapping]);

  // Sync trigger
  async function triggerSync() {
    setSyncing(true);
    setSyncStatus("Starting sync...");
    try {
      const res = await fetch("/api/email-analyzer/sync", { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        setSyncStatus(json.error ?? "Sync failed");
        setSyncing(false);
        return;
      }

      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/email-analyzer/sync");
          const statusJson = await statusRes.json();
          const status = statusJson.syncStatus;

          if (status === "completed") {
            clearInterval(poll);
            setSyncing(false);
            setSyncStatus("Sync complete!");
            // Refresh data
            if (view === "email") fetchEmails();
            else fetchDomains();
            setTimeout(() => setSyncStatus(null), 3000);
          } else if (status === "failed") {
            clearInterval(poll);
            setSyncing(false);
            setSyncStatus(statusJson.error ?? "Sync failed");
          } else {
            setSyncStatus("Syncing workspaces...");
          }
        } catch {
          clearInterval(poll);
          setSyncing(false);
          setSyncStatus("Failed to check status");
        }
      }, 3000);
    } catch {
      setSyncing(false);
      setSyncStatus("Network error");
    }
  }

  // Sort handlers
  function handleEmailSort(field: EmailSortField) {
    setEmailSort((prev) => ({
      by: field,
      dir: prev.by === field && prev.dir === "asc" ? "desc" : "asc",
    }));
    setEmailPage(1);
  }

  function handleDomainSort(field: DomainSortField) {
    setDomainSort((prev) => ({
      by: field,
      dir: prev.by === field && prev.dir === "asc" ? "desc" : "asc",
    }));
    setDomainPage(1);
  }

  // Resolve selected sender IDs (for domain view, expand domains to sender IDs)
  const resolvedSenderIds = useMemo(() => {
    if (view === "email") return [...selectedSenderIds];
    const ids: string[] = [];
    for (const domain of selectedDomains) {
      const domainIds = domainEmailMap.get(domain) ?? [];
      ids.push(...domainIds);
    }
    return ids;
  }, [view, selectedSenderIds, selectedDomains, domainEmailMap]);

  const selectionCount = view === "email" ? selectedSenderIds.size : selectedDomains.size;

  // Collect unique tags that exist on the selected emails (for Remove Tags dialog)
  const existingTagsOnSelection = useMemo(() => {
    const resolvedIds = new Set(resolvedSenderIds);
    const tagMap = new Map<number, Tag>();
    for (const email of emails) {
      if (resolvedIds.has(email.senderId)) {
        for (const tag of email.tags as Tag[]) {
          if (!tagMap.has(tag.id)) tagMap.set(tag.id, tag);
        }
      }
    }
    return [...tagMap.values()];
  }, [emails, resolvedSenderIds]);

  function clearSelection() {
    setSelectedSenderIds(new Set());
    setSelectedDomains(new Set());
  }

  function handleTagsUpdated() {
    clearSelection();
    if (view === "email") fetchEmails();
    else fetchDomains();
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Analyzer</h2>
          <p className="text-sm text-muted-foreground">
            Analyze email &amp; domain performance across workspaces
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus && (
            <Badge variant={syncStatus.includes("failed") || syncStatus.includes("error") ? "destructive" : "secondary"} className="text-xs">
              {syncStatus}
            </Badge>
          )}
          <Button onClick={triggerSync} disabled={syncing} size="sm">
            {syncing ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5 mr-1.5" />
            )}
            Sync Data
          </Button>
        </div>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Saved views */}
          <EmailAnalyzerViews
            scope={view}
            activeViewId={view === "email" ? activeEmailViewId : activeDomainViewId}
            currentFilters={view === "email" ? emailFilters : domainFilters}
            onActivate={(id, filters) => {
              if (view === "email") {
                setActiveEmailViewId(id);
                setEmailFilters(filters);
              } else {
                setActiveDomainViewId(id);
                setDomainFilters(filters);
              }
            }}
            onApplyFilters={(next) => {
              if (view === "email") setEmailFilters(next);
              else setDomainFilters(next);
            }}
          />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={view === "email" ? "Search emails..." : "Search domains..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-56"
            />
          </div>

          {/* Workspace filter (searchable) */}
          <Popover open={wsOpen} onOpenChange={setWsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 w-52 justify-between font-normal">
                <span className="truncate">{selectedWsName}</span>
                <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search workspaces..."
                  value={wsSearch}
                  onChange={(e) => setWsSearch(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                  onClick={() => { setWorkspaceId(""); setWsOpen(false); setWsSearch(""); }}
                >
                  <Check className={`size-3.5 ${!workspaceId ? "opacity-100" : "opacity-0"}`} />
                  All Workspaces
                </button>
                {filteredWorkspaces.map((ws) => (
                  <button
                    key={ws.id}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                    onClick={() => { setWorkspaceId(ws.id); setWsOpen(false); setWsSearch(""); }}
                  >
                    <Check className={`size-3.5 ${workspaceId === ws.id ? "opacity-100" : "opacity-0"}`} />
                    <span className="truncate">{ws.name}</span>
                  </button>
                ))}
                {filteredWorkspaces.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No workspaces found</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Advanced filter builder */}
          <EmailAnalyzerFilterBar
            columns={view === "email" ? EMAIL_COLUMNS : DOMAIN_COLUMNS}
            tags={tags}
            imapServers={imapServers}
            statuses={statuses}
            state={view === "email" ? emailFilters : domainFilters}
            onChange={(next) => {
              if (view === "email") setEmailFilters(next);
              else setDomainFilters(next);
            }}
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
          <Button
            variant={view === "email" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => { setView("email"); clearSelection(); }}
          >
            <Mail className="size-3 mr-1.5" />
            Email View
          </Button>
          <Button
            variant={view === "domain" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => { setView("domain"); clearSelection(); }}
          >
            <Globe className="size-3 mr-1.5" />
            Domain View
          </Button>
        </div>
      </div>

      {/* Table */}
      {view === "email" ? (
        <EmailAnalyzerTable
          emails={emails}
          meta={emailMeta}
          loading={loading}
          selectedIds={selectedSenderIds}
          onSelectionChange={setSelectedSenderIds}
          sortBy={emailSort.by}
          sortDir={emailSort.dir}
          onSort={handleEmailSort}
          page={emailPage}
          onPageChange={setEmailPage}
        />
      ) : (
        <DomainAnalyzerTable
          domains={domains}
          meta={domainMeta}
          loading={loading}
          selectedDomains={selectedDomains}
          onSelectionChange={setSelectedDomains}
          sortBy={domainSort.by}
          sortDir={domainSort.dir}
          onSort={handleDomainSort}
          page={domainPage}
          onPageChange={setDomainPage}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectionCount}
        selectedSenderIds={resolvedSenderIds}
        tags={tags}
        existingTags={existingTagsOnSelection}
        onClearSelection={clearSelection}
        onTagsUpdated={handleTagsUpdated}
      />
    </div>
  );
}
