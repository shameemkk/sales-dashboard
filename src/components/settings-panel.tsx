"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Mail, MessageSquare, CalendarDays, Save, CheckCircle2, RefreshCw,
  Loader2, Users, Sparkles, Clock, RotateCcw, Database, LayoutGrid, Timer,
  Plus, Pencil, Trash2, Key,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getDefaultCols, getDefaultTableDays, saveDefaultCols, saveDefaultTableDays } from "@/lib/settings";
import type { SyncSchedule, SyncExecutionLog, SyncType, Workspace } from "@/lib/data";

const EMAIL_COLS = [
  { key: "totalEmailsSent",       label: "Sent" },
  { key: "totalNewLeadsContacted",label: "New Leads" },
  { key: "totalReplies",          label: "Replies" },
  { key: "replyPct",              label: "Reply %" },
  { key: "totalPositiveReplies",  label: "Positive" },
  { key: "positivePct",           label: "Positive %" },
];

const MEETING_COLS = [
  { key: "todayAppointments",     label: "Today Appointments" },
  { key: "todayAppointmentsPct", label: "Today Appointments %" },
  { key: "bookings",             label: "Bookings" },
  { key: "meetingsShowUp",        label: "Showed Up" },
  { key: "showUpPct",             label: "Show Up %" },
  { key: "meetingsClosed",        label: "Closed" },
  { key: "closedPct",             label: "Closed %" },
  { key: "meetingsNoShow",        label: "No-Show" },
  { key: "noShowPct",             label: "No Show %" },
  { key: "meetingsDisqualified",  label: "Disqualified" },
  { key: "meetingsCanceled",      label: "Canceled" },
  { key: "meetingsRescheduled",   label: "Rescheduled" },
];

const DATE_OPTIONS = [
  { value: 7,  label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
  { value: 60, label: "Last 60 days" },
  { value: 90, label: "Last 90 days" },
];

const SYNC_TYPE_LABELS: Record<SyncType, string> = {
  contact_sync: "Contact",
  performance_sync: "Performance",
  email_analyzer_sync: "Email Performance",
};

const SYNC_TYPE_BADGE_CLASSES: Record<SyncType, string> = {
  contact_sync: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  performance_sync: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
  email_analyzer_sync: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
};

const IST_OFFSET = 5 * 60 + 30;

function utcToIst(utcTime: string, use12Hour = false): string {
  const [h, m] = utcTime.split(":").map(Number);
  let totalMin = h * 60 + m + IST_OFFSET;
  if (totalMin >= 1440) totalMin -= 1440;
  const hours24 = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (use12Hour) {
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
  }
  return `${String(hours24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function istToUtc(istTime: string): string {
  const [h, m] = istTime.split(":").map(Number);
  let totalMin = h * 60 + m - IST_OFFSET;
  if (totalMin < 0) totalMin += 1440;
  return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return "<1s";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* ── Nav items ───────────────────────────────────────────────────── */
type SettingsSection = "display" | "data" | "automation" | "tokens";
type DisplaySubSection = null | "performance-table";

const NAV_ITEMS: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: "display",    label: "Display",    icon: LayoutGrid, description: "Table defaults" },
  { id: "data",       label: "Data",       icon: Database,   description: "Sync & enrich" },
  { id: "automation", label: "Automation", icon: Clock,      description: "Scheduler" },
  { id: "tokens",     label: "Tokens",     icon: Key,        description: "API tokens" },
];

export function SettingsPanel() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("display");
  const [displaySub, setDisplaySub] = useState<DisplaySubSection>(null);

  const [cols, setCols] = useState<Set<string>>(() => getDefaultCols());
  const [days, setDays] = useState<number>(() => getDefaultTableDays());
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncDbCount, setSyncDbCount] = useState<number | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [enrichCounts, setEnrichCounts] = useState<{ enriched: number; total: number } | null>(null);

  // Unified schedule state
  const [schedules, setSchedules] = useState<SyncSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [schedulerDialogOpen, setSchedulerDialogOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SyncSchedule | null>(null);
  const [formType, setFormType] = useState<SyncType>("contact_sync");
  const [formTime, setFormTime] = useState("11:30");
  const [formSaving, setFormSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Unified history state
  const [syncHistory, setSyncHistory] = useState<SyncExecutionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histTotalCount, setHistTotalCount] = useState(0);
  const [histPaging, setHistPaging] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  // Contact sync polling state
  const [contactSyncing, setContactSyncing] = useState(false);
  const [contactSyncResult, setContactSyncResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Workspace tokens state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspaceRefreshing, setWorkspaceRefreshing] = useState(false);
  const [workspaceResult, setWorkspaceResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [wsPage, setWsPage] = useState(1);
  const [wsTotalPages, setWsTotalPages] = useState(1);
  const [wsTotalCount, setWsTotalCount] = useState(0);
  const [wsPaging, setWsPaging] = useState(false);

  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contactSyncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workspacePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorkspaces = useCallback(async (page = 1) => {
    setWsPaging(true);
    try {
      const r = await fetch(`/api/workspaces?page=${page}&limit=5`);
      const data = await r.json();
      setWorkspaces(data.workspaces ?? []);
      setWsPage(data.page ?? 1);
      setWsTotalPages(data.totalPages ?? 1);
      setWsTotalCount(data.totalCount ?? 0);
    } catch { /* ignore */ }
    setWsPaging(false);
    setWorkspacesLoading(false);
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const r = await fetch("/api/schedules");
      const data = await r.json();
      setSchedules(data.schedules ?? []);
    } catch { /* ignore */ }
    setSchedulesLoading(false);
  }, []);

  const fetchHistory = useCallback(async (page = 1) => {
    setHistPaging(true);
    try {
      const r = await fetch(`/api/sync-history?page=${page}&limit=5`);
      const data = await r.json();
      setSyncHistory(data.jobs ?? []);
      setHistPage(data.page ?? 1);
      setHistTotalPages(data.totalPages ?? 1);
      setHistTotalCount(data.totalCount ?? 0);
    } catch { /* ignore */ }
    setHistPaging(false);
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/leads-sync").then((r) => r.json()).then((s) => {
      setSyncDbCount(s.dbCount ?? 0);
      if (s.status === "running") { setSyncing(true); setSyncResult({ ok: true, message: "Syncing\u2026" }); startSyncPoll(); }
      else if (s.status === "completed") { setSyncResult({ ok: true, message: `Synced ${s.upserted} leads from ${s.pages} page${s.pages !== 1 ? "s" : ""}` }); }
    }).catch(() => {});
    fetch("/api/leads-enrich").then((r) => r.json()).then((s) => {
      setEnrichCounts({ enriched: s.enrichedCount ?? 0, total: s.totalCount ?? 0 });
      if (s.status === "running") { setEnriching(true); setEnrichResult({ ok: true, message: `${s.processed}/${s.total} leads enriched\u2026` }); startEnrichPoll(); }
      else if (s.status === "completed") { setEnrichResult({ ok: true, message: `Done! ${s.processed} leads enriched` }); }
    }).catch(() => {});
    fetch("/api/contact-sync").then((r) => r.json()).then((s) => {
      if (s.status === "running") { setContactSyncing(true); setContactSyncResult({ ok: true, message: "Syncing recent contacts\u2026" }); startContactSyncPoll(); }
      else if (s.status === "completed") { const e = s.contactsEnriched ? `, enriched ${s.contactsEnriched}` : ""; setContactSyncResult({ ok: true, message: `Synced ${s.contactsUpserted ?? 0} contacts${e}` }); }
      else if (s.status === "failed") { setContactSyncResult({ ok: false, message: s.error ?? "Contact sync failed" }); }
    }).catch(() => {});
    fetchSchedules();
    fetchHistory();
    fetchWorkspaces();
    return () => { if (syncPollRef.current) clearInterval(syncPollRef.current); if (enrichPollRef.current) clearInterval(enrichPollRef.current); if (contactSyncPollRef.current) clearInterval(contactSyncPollRef.current); if (workspacePollRef.current) clearInterval(workspacePollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startSyncPoll() {
    if (syncPollRef.current) clearInterval(syncPollRef.current);
    syncPollRef.current = setInterval(async () => {
      try { const r = await fetch("/api/leads-sync"); const s = await r.json(); setSyncDbCount(s.dbCount ?? 0);
        if (s.status === "completed") { clearInterval(syncPollRef.current!); syncPollRef.current = null; setSyncing(false); setSyncResult({ ok: true, message: `Synced ${s.upserted} leads from ${s.pages} page${s.pages !== 1 ? "s" : ""}` }); }
        else if (s.status === "failed") { clearInterval(syncPollRef.current!); syncPollRef.current = null; setSyncing(false); setSyncResult({ ok: false, message: s.error ?? "Sync failed" }); }
      } catch { /* ignore */ }
    }, 3000);
  }
  function startEnrichPoll() {
    if (enrichPollRef.current) clearInterval(enrichPollRef.current);
    enrichPollRef.current = setInterval(async () => {
      try { const r = await fetch("/api/leads-enrich"); const s = await r.json(); setEnrichCounts({ enriched: s.enrichedCount ?? 0, total: s.totalCount ?? 0 });
        if (s.status === "running") { setEnrichResult({ ok: true, message: `${s.processed}/${s.total} leads enriched\u2026` }); }
        else if (s.status === "completed") { clearInterval(enrichPollRef.current!); enrichPollRef.current = null; setEnriching(false); setEnrichResult({ ok: true, message: `Done! ${s.processed} leads enriched` }); }
        else if (s.status === "failed") { clearInterval(enrichPollRef.current!); enrichPollRef.current = null; setEnriching(false); setEnrichResult({ ok: false, message: s.error ?? "Enrich failed" }); }
      } catch { /* ignore */ }
    }, 2000);
  }
  function startContactSyncPoll() {
    if (contactSyncPollRef.current) clearInterval(contactSyncPollRef.current);
    contactSyncPollRef.current = setInterval(async () => {
      try { const r = await fetch("/api/contact-sync"); const s = await r.json();
        if (s.status === "completed") { clearInterval(contactSyncPollRef.current!); contactSyncPollRef.current = null; setContactSyncing(false); const e = s.contactsEnriched ? `, enriched ${s.contactsEnriched}` : ""; setContactSyncResult({ ok: true, message: `Synced ${s.contactsUpserted ?? 0} contacts${e}` }); fetchHistory(); }
        else if (s.status === "failed") { clearInterval(contactSyncPollRef.current!); contactSyncPollRef.current = null; setContactSyncing(false); setContactSyncResult({ ok: false, message: s.error ?? "Contact sync failed" }); fetchHistory(); }
      } catch { /* ignore */ }
    }, 3000);
  }

  function startWorkspacePoll() {
    if (workspacePollRef.current) clearInterval(workspacePollRef.current);
    workspacePollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/workspaces?page=1&limit=5");
        const s = await r.json();
        if (s.syncStatus === "completed") {
          clearInterval(workspacePollRef.current!); workspacePollRef.current = null;
          setWorkspaceRefreshing(false);
          setWsPage(1);
          setWsTotalPages(s.totalPages ?? 1);
          setWsTotalCount(s.totalCount ?? 0);
          setWorkspaces(s.workspaces ?? []);
          setWorkspaceResult({ ok: true, message: `Refreshed ${s.totalCount ?? 0} workspaces, created ${s.tokensCreated ?? 0} tokens` });
        } else if (s.syncStatus === "failed") {
          clearInterval(workspacePollRef.current!); workspacePollRef.current = null;
          setWorkspaceRefreshing(false);
          setWorkspaceResult({ ok: false, message: s.error ?? "Refresh failed" });
        }
      } catch { /* ignore */ }
    }, 3000);
  }
  async function handleWorkspaceRefresh() {
    setWorkspaceRefreshing(true); setWorkspaceResult(null);
    try {
      const res = await fetch("/api/workspaces", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      startWorkspacePoll();
    } catch (err) { setWorkspaceRefreshing(false); setWorkspaceResult({ ok: false, message: err instanceof Error ? err.message : "Refresh failed" }); }
  }

  function toggle(key: string) { setCols((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); setSaved(false); }
  async function handleLeadsSync() { setSyncing(true); setSyncResult(null); try { const res = await fetch("/api/leads-sync", { method: "POST" }); const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Sync failed"); startSyncPoll(); } catch (err) { setSyncing(false); setSyncResult({ ok: false, message: err instanceof Error ? err.message : "Sync failed" }); } }
  async function handleEnrich() { setEnriching(true); setEnrichResult(null); try { const res = await fetch("/api/leads-enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Enrich failed"); startEnrichPoll(); } catch (err) { setEnriching(false); setEnrichResult({ ok: false, message: err instanceof Error ? err.message : "Enrich failed" }); } }
  async function handleContactSync() { setContactSyncing(true); setContactSyncResult(null); try { const res = await fetch("/api/contact-sync", { method: "POST" }); const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Contact sync failed"); startContactSyncPoll(); } catch (err) { setContactSyncing(false); setContactSyncResult({ ok: false, message: err instanceof Error ? err.message : "Contact sync failed" }); } }
  function handleSave() { const toSave = new Set(cols); toSave.add("date"); saveDefaultCols(toSave); saveDefaultTableDays(days); setSaved(true); setTimeout(() => setSaved(false), 3000); }

  /* ── Schedule CRUD ── */
  function openAddForm() {
    // Determine which types are available (not yet scheduled)
    const usedTypes = new Set(schedules.map((s) => s.type));
    const available: SyncType[] = (["contact_sync", "performance_sync", "email_analyzer_sync"] as SyncType[]).filter((t) => !usedTypes.has(t));
    if (available.length === 0) return; // all types scheduled
    setFormType(available[0]);
    setFormTime("11:30");
    setEditingSchedule(null);
    setShowAddForm(true);
  }

  function openEditForm(sched: SyncSchedule) {
    setEditingSchedule(sched);
    setFormType(sched.type);
    setFormTime(utcToIst(sched.timeUtc));
    setShowAddForm(true);
  }

  async function handleSaveScheduleForm() {
    setFormSaving(true);
    try {
      if (editingSchedule) {
        // Update existing
        const res = await fetch(`/api/schedules/${editingSchedule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeUtc: istToUtc(formTime) }),
        });
        if (!res.ok) throw new Error("Failed to update");
      } else {
        // Create new
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: formType, timeUtc: istToUtc(formTime), enabled: true }),
        });
        if (!res.ok) throw new Error("Failed to create");
      }
      setShowAddForm(false);
      setEditingSchedule(null);
      await fetchSchedules();
    } catch { /* ignore */ }
    setFormSaving(false);
  }

  async function handleToggleSchedule(id: number, enabled: boolean) {
    try {
      await fetch(`/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, enabled } : s));
    } catch { /* ignore */ }
  }

  async function handleDeleteSchedule(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      await fetchSchedules();
    } catch { /* ignore */ }
    setDeletingId(null);
  }

  async function handleRetry(jobId: number) {
    setRetryingJobId(jobId);
    try {
      const res = await fetch("/api/sync-history/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!res.ok) throw new Error("Retry failed");
      await fetchHistory();
    } catch { /* ignore */ }
    setRetryingJobId(null);
  }

  // Which types can still be added
  const usedTypes = new Set(schedules.map((s) => s.type));
  const canAddSchedule = usedTypes.size < 2;

  return (
    <div className="flex h-full">
      {/* ── Settings sidebar ─────────────────────────────────────── */}
      <nav className="hidden md:flex w-56 shrink-0 flex-col border-r bg-muted/30 px-3 py-6">
        <h3 className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Settings
        </h3>
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setDisplaySub(null); }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-background text-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate">{item.label}</p>
                  <p className={`truncate text-xs ${isActive ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile tab bar ───────────────────────────────────────── */}
      <div className="md:hidden flex border-b w-full absolute top-0 left-0 right-0 bg-background z-10">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveSection(item.id); setDisplaySub(null); }}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ── Content area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className={`w-full px-6 py-8 md:px-8 space-y-6 md:pt-8 pt-16 ${activeSection === "automation" ? "max-w-4xl" : "max-w-2xl"}`}>

          {/* ═══ Display Preferences ═══ */}
          {activeSection === "display" && (
            <>
              {displaySub === null ? (
                /* ── Card grid ── */
                <>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                      <LayoutGrid className="size-5" />
                      Display Preferences
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a section to configure
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      onClick={() => setDisplaySub("performance-table")}
                      className="text-left"
                    >
                      <Card className="transition-colors hover:border-primary/50 hover:shadow-md cursor-pointer h-full">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                              <LayoutGrid className="h-4.5 w-4.5 text-blue-500" />
                            </div>
                            <div>
                              <CardTitle className="text-base">Performance Table</CardTitle>
                              <CardDescription>Date range & visible columns</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground">
                            {cols.size} columns selected &middot; Last {days} days
                          </p>
                        </CardContent>
                      </Card>
                    </button>
                  </div>
                </>
              ) : (
                /* ── Performance Table sub-view ── */
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisplaySub(null)}
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        &larr; Back
                      </Button>
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                          <LayoutGrid className="size-5" />
                          Performance Table
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Default date range and visible columns
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {saved && (
                        <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="size-4" /> Saved!
                        </span>
                      )}
                      <Button onClick={handleSave} className="gap-2">
                        <Save className="size-4" />
                        Save
                      </Button>
                    </div>
                  </div>

                  <Card>
                    <CardContent className="pt-6 space-y-6">
                      {/* Date Range */}
                      <div>
                        <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          <CalendarDays className="size-3" /> Date Range
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {DATE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => { setDays(opt.value); setSaved(false); }}
                              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                                days === opt.value
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background hover:bg-muted text-foreground"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Email columns */}
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                          <Mail className="size-3" /> Email Activity
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {EMAIL_COLS.map((col) => (
                            <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted">
                              <input type="checkbox" checked={cols.has(col.key)} onChange={() => toggle(col.key)} className="h-4 w-4 rounded accent-primary cursor-pointer" />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Meeting columns */}
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                          <MessageSquare className="size-3" /> Meetings
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {MEETING_COLS.map((col) => (
                            <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted">
                              <input type="checkbox" checked={cols.has(col.key)} onChange={() => toggle(col.key)} className="h-4 w-4 rounded accent-primary cursor-pointer" />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {/* ═══ Data Management ═══ */}
          {activeSection === "data" && (
            <>
              <div>
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <Database className="size-5" />
                  Data Management
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manually sync and enrich leads from GoHighLevel
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Users className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Sync Leads</CardTitle>
                        <CardDescription>
                          Pull all contacts from GHL
                          {syncDbCount !== null && <span className="ml-1 font-medium text-foreground">({syncDbCount} in DB)</span>}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleLeadsSync} disabled={syncing} variant="outline" className="gap-2 w-full">
                      {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      {syncing ? "Syncing\u2026" : "Sync All Leads"}
                    </Button>
                    {syncResult && (
                      <p className={`mt-2 text-sm font-medium ${syncResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {syncResult.message}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Enrich Leads</CardTitle>
                        <CardDescription>
                          Fetch first dial/text times
                          {enrichCounts && <span className="ml-1 font-medium text-foreground">({enrichCounts.enriched}/{enrichCounts.total})</span>}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleEnrich} disabled={enriching} variant="outline" className="gap-2 w-full">
                      {enriching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {enriching ? "Enriching\u2026" : "Enrich All Leads"}
                    </Button>
                    {enrichResult && (
                      <p className={`mt-2 text-sm font-medium ${enrichResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {enrichResult.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* ═══ Automation ═══ */}
          {activeSection === "automation" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                    <Clock className="size-5" />
                    Execution History
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Recent scheduled and manual sync runs
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSchedulerDialogOpen(true)}
                  className="shrink-0 gap-2"
                >
                  <Timer className="size-4" />
                  Schedules
                </Button>
              </div>

              {/* Unified History Table */}
              <Card>
                <CardContent className="pt-6">
                  {historyLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading history...
                    </div>
                  ) : syncHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sync runs yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-36">Type</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead className="min-w-36">Details</TableHead>
                            <TableHead className="min-w-40">Started</TableHead>
                            <TableHead className="w-24">Duration</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {syncHistory.map((job) => (
                            <TableRow key={job.id}>
                              <TableCell className="text-sm font-medium">
                                {SYNC_TYPE_LABELS[job.type]}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={job.status === "completed" ? "default" : job.status === "running" ? "secondary" : "destructive"}
                                  className={
                                    job.status === "completed"
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                      : job.status === "running"
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                        : ""
                                  }
                                >
                                  {job.status === "running" && <Loader2 className="size-3 animate-spin" />}
                                  {job.status}
                                  {job.retryCount > 0 && ` (#${job.retryCount})`}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm tabular-nums">
                                {job.type === "contact_sync"
                                  ? `${job.contactsUpserted ?? 0} contacts`
                                  : job.type === "email_analyzer_sync"
                                    ? `${job.contactsFetched ?? 0} workspaces · ${job.rowsSynced ?? 0} emails`
                                    : job.syncDate
                                      ? job.syncDate
                                      : `${job.rowsSynced ?? 0} rows`
                                }
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatTime(job.startedAt)}</TableCell>
                              <TableCell className="text-sm tabular-nums">{formatDuration(job.startedAt, job.completedAt)}</TableCell>
                              <TableCell>
                                {job.status === "failed" && (
                                  <Button onClick={() => handleRetry(job.id)} disabled={retryingJobId === job.id} variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                                    {retryingJobId === job.id ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                                    Retry
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {syncHistory.some((j) => j.status === "failed" && j.errorMessage) && (
                        <div className="mt-3 space-y-1">
                          {syncHistory.filter((j) => j.status === "failed" && j.errorMessage).slice(0, 3).map((j) => (
                            <p key={j.id} className="text-xs text-red-600 dark:text-red-400 truncate" title={j.errorMessage ?? ""}>
                              Job #{j.id} ({SYNC_TYPE_LABELS[j.type]}): {j.errorMessage}
                            </p>
                          ))}
                        </div>
                      )}
                      {histTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-sm text-muted-foreground">
                            Page {histPage} of {histTotalPages} ({histTotalCount} total)
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={histPage <= 1 || histPaging}
                              onClick={() => fetchHistory(histPage - 1)}
                              className="gap-1.5"
                            >
                              {histPaging && histPage > 1 && <Loader2 className="size-3 animate-spin" />}
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={histPage >= histTotalPages || histPaging}
                              onClick={() => fetchHistory(histPage + 1)}
                              className="gap-1.5"
                            >
                              Next
                              {histPaging && histPage < histTotalPages && <Loader2 className="size-3 animate-spin" />}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Schedule Management Dialog ── */}
              <Dialog open={schedulerDialogOpen} onOpenChange={(open) => { setSchedulerDialogOpen(open); if (!open) { setShowAddForm(false); setEditingSchedule(null); } }}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Timer className="size-4 text-purple-500" />
                      Sync Schedules
                    </DialogTitle>
                    <DialogDescription>
                      Manage automated daily sync schedules
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    {schedulesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Loading schedules...
                      </div>
                    ) : showAddForm ? (
                      <>
                        {/* Add / Edit form (replaces schedule list) */}
                        <div className="rounded-lg border border-dashed p-4 space-y-3">
                          <p className="text-sm font-medium">{editingSchedule ? "Edit Schedule" : "Add Schedule"}</p>
                          {!editingSchedule && (
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-muted-foreground whitespace-nowrap">Type:</label>
                              <Select value={formType} onValueChange={(v) => setFormType(v as SyncType)}>
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(["contact_sync", "performance_sync", "email_analyzer_sync"] as SyncType[])
                                    .filter((t) => !usedTypes.has(t))
                                    .map((t) => (
                                      <SelectItem key={t} value={t}>
                                        {SYNC_TYPE_LABELS[t]}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {editingSchedule && (
                            <p className="text-xs text-muted-foreground">
                              {SYNC_TYPE_LABELS[editingSchedule.type]}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground whitespace-nowrap">Run at (IST):</label>
                            <Input
                              type="time"
                              value={formTime}
                              onChange={(e) => setFormTime(e.target.value)}
                              className="w-32"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button onClick={handleSaveScheduleForm} disabled={formSaving} size="sm" className="gap-1.5">
                              {formSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                              {editingSchedule ? "Update" : "Create"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setShowAddForm(false); setEditingSchedule(null); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Schedule list */}
                        {schedules.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">No schedules configured yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {schedules.map((sched) => (
                              <div key={sched.id} className="flex items-center gap-3 rounded-lg border p-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={SYNC_TYPE_BADGE_CLASSES[sched.type]}
                                    >
                                      {SYNC_TYPE_LABELS[sched.type]}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Daily at {utcToIst(sched.timeUtc, true)} IST
                                    {sched.type === "performance_sync" && " (syncs yesterday's data)"}
                                  </p>
                                </div>
                                <Switch
                                  checked={sched.enabled}
                                  onCheckedChange={(checked) => handleToggleSchedule(sched.id, checked)}
                                  size="sm"
                                />
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditForm(sched)}>
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                  onClick={() => handleDeleteSchedule(sched.id)}
                                  disabled={deletingId === sched.id}
                                >
                                  {deletingId === sched.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {canAddSchedule ? (
                          <Button variant="outline" size="sm" onClick={openAddForm} className="gap-1.5 w-full">
                            <Plus className="size-3.5" />
                            Add Schedule
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* ═══ Workspace Tokens ═══ */}
          {activeSection === "tokens" && (
            <>
              <div>
                <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <Key className="size-5" />
                  Workspace Tokens
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage API tokens for Instantly workspaces
                </p>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Workspaces</CardTitle>
                      <CardDescription>{wsTotalCount} workspaces in database</CardDescription>
                    </div>
                    <Button onClick={handleWorkspaceRefresh} disabled={workspaceRefreshing} className="gap-2">
                      {workspaceRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      {workspaceRefreshing ? "Refreshing..." : "Refresh & Create"}
                    </Button>
                  </div>
                  {workspaceResult && (
                    <p className={`text-sm font-medium mt-2 ${workspaceResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {workspaceResult.message}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {workspacesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading workspaces...
                    </div>
                  ) : workspaces.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No workspaces found. Click &quot;Refresh &amp; Create&quot; to fetch from API.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Enabled</TableHead>
                            <TableHead>Workspace Name</TableHead>
                            <TableHead>ID</TableHead>
                            <TableHead>API Token</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workspaces.map((ws) => (
                            <TableRow key={ws.id} className={ws.enabled ? "" : "opacity-50"}>
                              <TableCell>
                                <Switch
                                  checked={ws.enabled}
                                  onCheckedChange={async (checked) => {
                                    setWorkspaces((prev) => prev.map((w) => w.id === ws.id ? { ...w, enabled: checked } : w));
                                    await fetch("/api/workspaces", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: ws.id, enabled: checked }),
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{ws.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono">{ws.id}</TableCell>
                              <TableCell>
                                <Badge variant={ws.hasToken ? "default" : "destructive"}>
                                  {ws.hasToken ? "Created" : "Not Available"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {wsTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-4">
                          <p className="text-sm text-muted-foreground">
                            Page {wsPage} of {wsTotalPages}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={wsPage <= 1 || wsPaging}
                              onClick={() => fetchWorkspaces(wsPage - 1)}
                              className="gap-1.5"
                            >
                              {wsPaging && wsPage > 1 && <Loader2 className="size-3 animate-spin" />}
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={wsPage >= wsTotalPages || wsPaging}
                              onClick={() => fetchWorkspaces(wsPage + 1)}
                              className="gap-1.5"
                            >
                              Next
                              {wsPaging && wsPage < wsTotalPages && <Loader2 className="size-3 animate-spin" />}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
