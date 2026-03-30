"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Lead } from "@/lib/data";

interface Meta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const GHL_LOCATION_ID = "2euS49kV93yDVpJrKvZi";
const GHL_BASE = `https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}`;

function contactUrl(id: string): string {
  return `${GHL_BASE}/contacts/detail/${id}`;
}

function opportunityUrl(opportunityId: string): string {
  return `${GHL_BASE}/opportunities/list/${opportunityId}?tab=Opportunity+Details`;
}

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
  }) + " " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function minutesBetween(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  return `${mins} min`;
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

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("search", search);

    fetch(`/api/leads?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setLeads((json.data ?? []).map(mapLead));
        setMeta(json.meta ?? null);
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
  }, [page, search]);

  const total = meta?.total ?? 0;
  const lastPage = meta?.last_page ?? 1;
  const from = total === 0 ? 0 : (page - 1) * (meta?.per_page ?? 250) + 1;
  const to = Math.min(page * (meta?.per_page ?? 250), total);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Leads</CardTitle>
            <CardDescription>
              {total} lead{total !== 1 ? "s" : ""} synced from GoHighLevel
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search leads…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Date Added</TableHead>
                <TableHead className="min-w-[140px]">Name</TableHead>
                <TableHead className="min-w-[180px]">Email</TableHead>
                <TableHead className="min-w-[130px]">Phone</TableHead>
                <TableHead className="min-w-[120px]">Tags</TableHead>
                <TableHead className="min-w-[150px]">First Dial</TableHead>
                <TableHead className="min-w-[130px]">Time to Dial</TableHead>
                <TableHead className="min-w-[150px]">First Text</TableHead>
                <TableHead className="min-w-[130px]">Time to Text</TableHead>
                <TableHead className="min-w-[80px]">Links</TableHead>
                <TableHead className="min-w-[200px]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-12 text-center text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="size-8 opacity-30" />
                      <p className="text-sm">No leads found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(lead.dateAdded)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{lead.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">{lead.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lead.tags.length > 0
                          ? lead.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(lead.firstDialTime)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums font-medium">
                      {minutesBetween(lead.dateAdded, lead.firstDialTime)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(lead.firstTextTime)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums font-medium">
                      {minutesBetween(lead.dateAdded, lead.firstTextTime)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <a
                          href={contactUrl(lead.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open contact in GHL"
                        >
                          <ExternalLink className="size-4 text-blue-500 hover:text-blue-700 transition-colors" />
                        </a>
                        {lead.opportunityId && (
                          <a
                            href={opportunityUrl(lead.opportunityId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open opportunity in GHL"
                          >
                            <ExternalLink className="size-4 text-violet-500 hover:text-violet-700 transition-colors" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {lead.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && !error && lastPage > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
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
                    className="size-8 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
