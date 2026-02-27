"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailAccountsTable } from "@/components/email-accounts-table";
import { AnimatedCounter } from "@/components/animated-counter";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, MessageSquare, Flame } from "lucide-react";
import type { EmailAccount } from "@/lib/data";

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
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/sender-emails?${params}`)
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
  }, [page, search, statusFilter]);

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
        />
      )}
    </div>
  );
}
