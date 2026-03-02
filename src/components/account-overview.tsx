"use client";

import { useState, useEffect, useRef } from "react";
import { subDays, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailAccountsTable } from "@/components/email-accounts-table";
import { AnimatedCounter } from "@/components/animated-counter";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, MessageSquare, Flame } from "lucide-react";
import { DateRangePicker } from "@/components/date-picker";
import { SyncStatusPanel } from "@/components/sync-status-panel";
import type { EmailAccount, Tag, AccountDailyStat } from "@/lib/data";

export type TagFilterMode = "" | "has_tags" | "no_tags" | "exclude_tags";

interface ApiMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAccount(item: any): EmailAccount {
  const sent: number = item.emails_sent_count ?? 0;
  const replied: number = item.total_replied_count ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTags: any[] = Array.isArray(item.tags) ? item.tags : [];
  const tags: string[] = rawTags.map((t) =>
    typeof t === "string" ? t : typeof t?.name === "string" ? t.name : String(t)
  );
  return {
    id: String(item.id),
    email: item.email as string,
    totalEmailsSent: sent,
    totalReplies: replied,
    replyRate: sent > 0 ? (replied / sent) * 100 : 0,
    totalWarmupsSent: 0,
    warmupEnabled: item.warmup_enabled === true,
    dailyLimit: item.daily_limit ?? 0,
    status: item.status === "Connected" ? "active" : "inactive",
    tags,
  };
}

export function AccountOverview() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "connected" | "not_connected">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tag filter state
  const [tagFilterMode, setTagFilterMode] = useState<TagFilterMode>("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  // Daily stats date range (default last 7 days)
  const [statsStartDate, setStatsStartDate] = useState<Date>(() => subDays(new Date(), 6));
  const [statsEndDate, setStatsEndDate] = useState<Date>(() => new Date());
  const [statsMap, setStatsMap] = useState<Map<string, AccountDailyStat[]>>(new Map());
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch available tags once
  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setTags(data.data ?? []))
      .catch(() => {})
      .finally(() => setTagsLoading(false));
  }, []);

  // Debounce search input → search (400 ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  }

  useEffect(() => {
    // Don't call the API when switching to a tag-selecting mode before any tag is chosen
    if (
      (tagFilterMode === "has_tags" || tagFilterMode === "exclude_tags") &&
      selectedTagIds.length === 0
    ) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    // Tag filter params
    if (tagFilterMode === "has_tags" && selectedTagIds.length > 0) {
      selectedTagIds.forEach((id) => params.append("tag_ids[]", String(id)));
    } else if (tagFilterMode === "no_tags") {
      params.set("without_tags", "true");
    } else if (tagFilterMode === "exclude_tags" && selectedTagIds.length > 0) {
      selectedTagIds.forEach((id) => params.append("excluded_tag_ids[]", String(id)));
    }

    fetch(`/api/accounts?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setAccounts((data.data ?? []).map(mapAccount));
          setMeta(data.meta ?? null);
          setLoading(false);
        }
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
  }, [page, search, statusFilter, tagFilterMode, selectedTagIds]);

  // Fetch daily stats for every account on the current page
  useEffect(() => {
    if (accounts.length === 0) return;
    const start = format(statsStartDate, "yyyy-MM-dd");
    const end = format(statsEndDate, "yyyy-MM-dd");
    let cancelled = false;
    setStatsLoading(true);

    const ids = accounts.map((a) => a.id).join(",");

    fetch(`/api/account-stats?ids=${ids}&start_date=${start}&end_date=${end}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((payload) => {
        if (cancelled) return;
        const map = new Map<string, AccountDailyStat[]>();
        for (const row of (payload.data as AccountDailyStat[])) {
          const key = String(row.sender_id);
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(row);
        }
        setStatsMap(map);
        setStatsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStatsMap(new Map());
        setStatsLoading(false);
      });

    return () => { cancelled = true; };
  }, [accounts, statsStartDate, statsEndDate]);

  function handleTagFilterModeChange(mode: TagFilterMode) {
    setTagFilterMode(mode);
    // Clear selected tags when switching to modes that don't need them
    if (mode === "" || mode === "no_tags") setSelectedTagIds([]);
    setPage(1);
  }

  const totalAccounts = meta?.total ?? 0;
  const warmupCount = accounts.filter((a) => a.warmupEnabled).length;
  const totalEmailsSent = accounts.reduce((s, a) => s + a.totalEmailsSent, 0);
  const totalReplies = accounts.reduce((s, a) => s + a.totalReplies, 0);
  const overallReplyRate =
    totalEmailsSent > 0
      ? ((totalReplies / totalEmailsSent) * 100).toFixed(1)
      : "0.0";

  const summaryCards = [
    {
      title: "Total Accounts",
      value: totalAccounts,
      sub: meta
        ? `Page ${meta.current_page} of ${meta.last_page}`
        : "Loading…",
      icon: Users,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Emails Sent",
      value: totalEmailsSent,
      sub: "This page",
      icon: Mail,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "Reply Rate",
      value: null as number | null,
      displayValue: `${overallReplyRate}%`,
      sub: `${totalReplies} replies · this page`,
      icon: MessageSquare,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Warmup Enabled",
      value: warmupCount,
      sub: `of ${accounts.length} on this page`,
      icon: Flame,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account Overview</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          All email accounts and their performance metrics
        </p>
      </div>

      {/* Sync Status */}
      <SyncStatusPanel />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </CardTitle>
              <div
                className={`${card.bgColor} rounded-lg p-2 transition-transform duration-200 group-hover:scale-110`}
              >
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : card.value !== null ? (
                  <AnimatedCounter value={card.value} />
                ) : (
                  card.displayValue
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Stats Date Range */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Daily Stats Range</p>
          <p className="text-xs text-muted-foreground">
            Day-by-day breakdown shown when you expand an account row
          </p>
        </div>
        <DateRangePicker
          startDate={statsStartDate}
          endDate={statsEndDate}
          onStartDateChange={setStatsStartDate}
          onEndDateChange={setStatsEndDate}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <EmailAccountsTable
          accounts={accounts}
          meta={meta}
          loading={loading}
          searchInput={searchInput}
          onSearchChange={handleSearchChange}
          onPageChange={setPage}
          statusFilter={statusFilter}
          onStatusChange={(s: "" | "connected" | "not_connected") => { setStatusFilter(s); setPage(1); }}
          tags={tags}
          tagsLoading={tagsLoading}
          tagFilterMode={tagFilterMode}
          selectedTagIds={selectedTagIds}
          onTagFilterModeChange={handleTagFilterModeChange}
          onSelectedTagIdsChange={(ids) => { setSelectedTagIds(ids); setPage(1); }}
          statsMap={statsMap}
          statsLoading={statsLoading}
          statsStartDate={format(statsStartDate, "yyyy-MM-dd")}
          statsEndDate={format(statsEndDate, "yyyy-MM-dd")}
        />
      )}
    </div>
  );
}
