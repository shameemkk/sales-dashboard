"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Mail, MessageSquare, CalendarDays, Save, CheckCircle2, RefreshCw, Loader2, Users, Sparkles, Clock, History, RotateCcw } from "lucide-react";
import { getDefaultCols, getDefaultTableDays, saveDefaultCols, saveDefaultTableDays } from "@/lib/settings";
import type { ContactSyncJob } from "@/lib/data";

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

const IST_OFFSET = 5 * 60 + 30; // IST is UTC+5:30 in minutes

/** Convert HH:MM UTC to HH:MM IST for display */
function utcToIst(utcTime: string): string {
  const [h, m] = utcTime.split(":").map(Number);
  let totalMin = h * 60 + m + IST_OFFSET;
  if (totalMin >= 1440) totalMin -= 1440;
  const ih = Math.floor(totalMin / 60);
  const im = totalMin % 60;
  return `${String(ih).padStart(2, "0")}:${String(im).padStart(2, "0")}`;
}

/** Convert HH:MM IST to HH:MM UTC for storage */
function istToUtc(istTime: string): string {
  const [h, m] = istTime.split(":").map(Number);
  let totalMin = h * 60 + m - IST_OFFSET;
  if (totalMin < 0) totalMin += 1440;
  const uh = Math.floor(totalMin / 60);
  const um = totalMin % 60;
  return `${String(uh).padStart(2, "0")}:${String(um).padStart(2, "0")}`;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return "<1s";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function SettingsPanel() {
  const [cols, setCols] = useState<Set<string>>(() => getDefaultCols());
  const [days, setDays] = useState<number>(() => getDefaultTableDays());
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncDbCount, setSyncDbCount] = useState<number | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [enrichCounts, setEnrichCounts] = useState<{ enriched: number; total: number } | null>(null);

  // Scheduled contact sync state — scheduleTime is in IST for display
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("11:30"); // default 06:00 UTC = 11:30 IST
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [contactSyncing, setContactSyncing] = useState(false);
  const [contactSyncResult, setContactSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [contactSyncHistory, setContactSyncHistory] = useState<ContactSyncJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contactSyncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch("/api/contact-sync/history");
      const data = await r.json();
      setContactSyncHistory(data.jobs ?? []);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }, []);

  // Check status on mount (persists across page refresh)
  useEffect(() => {
    // Check sync status
    fetch("/api/leads-sync").then((r) => r.json()).then((s) => {
      setSyncDbCount(s.dbCount ?? 0);
      if (s.status === "running") {
        setSyncing(true);
        setSyncResult({ ok: true, message: "Syncing\u2026" });
        startSyncPoll();
      } else if (s.status === "completed") {
        setSyncResult({ ok: true, message: `Synced ${s.upserted} leads from ${s.pages} page${s.pages !== 1 ? "s" : ""}` });
      }
    }).catch(() => {});

    // Check enrich status
    fetch("/api/leads-enrich").then((r) => r.json()).then((s) => {
      setEnrichCounts({ enriched: s.enrichedCount ?? 0, total: s.totalCount ?? 0 });
      if (s.status === "running") {
        setEnriching(true);
        setEnrichResult({ ok: true, message: `${s.processed}/${s.total} leads enriched\u2026` });
        startEnrichPoll();
      } else if (s.status === "completed") {
        setEnrichResult({ ok: true, message: `Done! ${s.processed} leads enriched` });
      }
    }).catch(() => {});

    // Load schedule config (backend stores UTC, display as IST)
    fetch("/api/contact-sync/schedule").then((r) => r.json()).then((s) => {
      setScheduleEnabled(s.enabled ?? false);
      setScheduleTime(utcToIst(s.timeUtc ?? "06:00"));
    }).catch(() => {}).finally(() => setScheduleLoading(false));

    // Check contact sync status
    fetch("/api/contact-sync").then((r) => r.json()).then((s) => {
      if (s.status === "running") {
        setContactSyncing(true);
        setContactSyncResult({ ok: true, message: "Syncing recent contacts\u2026" });
        startContactSyncPoll();
      } else if (s.status === "completed") {
        const enrichMsg = s.contactsEnriched ? `, enriched ${s.contactsEnriched}` : "";
        setContactSyncResult({ ok: true, message: `Synced ${s.contactsUpserted ?? 0} contacts${enrichMsg}` });
      } else if (s.status === "failed") {
        setContactSyncResult({ ok: false, message: s.error ?? "Contact sync failed" });
      }
    }).catch(() => {});

    // Load history
    fetchHistory();

    return () => {
      if (syncPollRef.current) clearInterval(syncPollRef.current);
      if (enrichPollRef.current) clearInterval(enrichPollRef.current);
      if (contactSyncPollRef.current) clearInterval(contactSyncPollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startSyncPoll() {
    if (syncPollRef.current) clearInterval(syncPollRef.current);
    syncPollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/leads-sync");
        const s = await r.json();
        setSyncDbCount(s.dbCount ?? 0);
        if (s.status === "completed") {
          clearInterval(syncPollRef.current!);
          syncPollRef.current = null;
          setSyncing(false);
          setSyncResult({ ok: true, message: `Synced ${s.upserted} leads from ${s.pages} page${s.pages !== 1 ? "s" : ""}` });
        } else if (s.status === "failed") {
          clearInterval(syncPollRef.current!);
          syncPollRef.current = null;
          setSyncing(false);
          setSyncResult({ ok: false, message: s.error ?? "Sync failed" });
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  function startEnrichPoll() {
    if (enrichPollRef.current) clearInterval(enrichPollRef.current);
    enrichPollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/leads-enrich");
        const s = await r.json();
        setEnrichCounts({ enriched: s.enrichedCount ?? 0, total: s.totalCount ?? 0 });
        if (s.status === "running") {
          setEnrichResult({ ok: true, message: `${s.processed}/${s.total} leads enriched\u2026` });
        } else if (s.status === "completed") {
          clearInterval(enrichPollRef.current!);
          enrichPollRef.current = null;
          setEnriching(false);
          setEnrichResult({ ok: true, message: `Done! ${s.processed} leads enriched` });
        } else if (s.status === "failed") {
          clearInterval(enrichPollRef.current!);
          enrichPollRef.current = null;
          setEnriching(false);
          setEnrichResult({ ok: false, message: s.error ?? "Enrich failed" });
        }
      } catch { /* ignore */ }
    }, 2000);
  }

  function startContactSyncPoll() {
    if (contactSyncPollRef.current) clearInterval(contactSyncPollRef.current);
    contactSyncPollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/contact-sync");
        const s = await r.json();
        if (s.status === "completed") {
          clearInterval(contactSyncPollRef.current!);
          contactSyncPollRef.current = null;
          setContactSyncing(false);
          const enrichMsg = s.contactsEnriched ? `, enriched ${s.contactsEnriched}` : "";
          setContactSyncResult({ ok: true, message: `Synced ${s.contactsUpserted ?? 0} contacts${enrichMsg}` });
          fetchHistory();
        } else if (s.status === "failed") {
          clearInterval(contactSyncPollRef.current!);
          contactSyncPollRef.current = null;
          setContactSyncing(false);
          setContactSyncResult({ ok: false, message: s.error ?? "Contact sync failed" });
          fetchHistory();
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  function toggle(key: string) {
    setCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }

  async function handleLeadsSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/leads-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      startSyncPoll();
    } catch (err) {
      setSyncing(false);
      setSyncResult({ ok: false, message: err instanceof Error ? err.message : "Sync failed" });
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const res = await fetch("/api/leads-enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Enrich failed");
      startEnrichPoll();
    } catch (err) {
      setEnriching(false);
      setEnrichResult({ ok: false, message: err instanceof Error ? err.message : "Enrich failed" });
    }
  }

  async function handleContactSync() {
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
  }

  async function handleSaveSchedule() {
    try {
      const res = await fetch("/api/contact-sync/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: scheduleEnabled, timeUtc: istToUtc(scheduleTime) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 3000);
    } catch { /* ignore */ }
  }

  async function handleRetry(jobId: number) {
    setRetryingJobId(jobId);
    try {
      const res = await fetch("/api/contact-sync/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!res.ok) throw new Error("Retry failed");
      setContactSyncing(true);
      setContactSyncResult({ ok: true, message: "Retrying contact sync\u2026" });
      startContactSyncPoll();
    } catch { /* ignore */ }
    setRetryingJobId(null);
  }

  function handleSave() {
    // Always keep "date" column
    const toSave = new Set(cols);
    toSave.add("date");
    saveDefaultCols(toSave);
    saveDefaultTableDays(days);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 md:px-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure defaults stored in your browser. Applied on next page load.
        </p>
      </div>

      {/* Default Date Range */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Default Date Range</CardTitle>
              <CardDescription>Performance Table date range on first load</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Default Columns */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Mail className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Default Columns</CardTitle>
              <CardDescription>Which columns are visible by default in the Performance Table</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Email columns */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              <Mail className="size-3" /> Email Activity
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EMAIL_COLS.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={cols.has(col.key)}
                    onChange={() => toggle(col.key)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
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
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={cols.has(col.key)}
                    onChange={() => toggle(col.key)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Leads */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base">Sync Leads</CardTitle>
              <CardDescription>
                Pull all contacts from GoHighLevel into the leads table
                {syncDbCount !== null && <span className="ml-1 font-medium text-foreground">({syncDbCount} in DB)</span>}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button onClick={handleLeadsSync} disabled={syncing} variant="outline" className="gap-2">
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {syncing ? "Syncing\u2026" : "Sync All Leads"}
            </Button>
            {syncResult && (
              <span className={`text-sm font-medium ${syncResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {syncResult.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enrich Leads */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base">Enrich Leads</CardTitle>
              <CardDescription>
                Fetch first dial/text times from GoHighLevel conversations
                {enrichCounts && <span className="ml-1 font-medium text-foreground">({enrichCounts.enriched}/{enrichCounts.total} enriched)</span>}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button onClick={handleEnrich} disabled={enriching} variant="outline" className="gap-2">
              {enriching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {enriching ? "Enriching\u2026" : "Enrich All Leads"}
            </Button>
            {enrichResult && (
              <span className={`text-sm font-medium ${enrichResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {enrichResult.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Contact Sync */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
              <Clock className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-base">Scheduled Contact Sync</CardTitle>
              <CardDescription>Automatically sync contacts added in the last 5 days from GoHighLevel</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheduleLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading schedule...
            </div>
          ) : (
            <>
              {/* Schedule controls */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setScheduleEnabled(!scheduleEnabled)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    scheduleEnabled
                      ? "border-purple-500 bg-purple-500 text-white"
                      : "border-border bg-background hover:bg-muted text-foreground"
                  }`}
                >
                  {scheduleEnabled ? "Enabled" : "Disabled"}
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">Run at (IST):</label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button onClick={handleSaveSchedule} variant="outline" size="sm" className="gap-1.5">
                  <Save className="size-3.5" />
                  Save Schedule
                </Button>
                {scheduleSaved && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="size-3.5" />
                    Saved
                  </span>
                )}
              </div>

              {/* Manual trigger */}
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleContactSync} disabled={contactSyncing} variant="outline" className="gap-2">
                  {contactSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {contactSyncing ? "Syncing\u2026" : "Sync Now"}
                </Button>
                {contactSyncResult && (
                  <span className={`text-sm font-medium ${contactSyncResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {contactSyncResult.message}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Sync History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10">
              <History className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <CardTitle className="text-base">Contact Sync History</CardTitle>
              <CardDescription>Recent automated and manual contact sync runs</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading history...
            </div>
          ) : contactSyncHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-20 text-right">Contacts</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="w-20">Duration</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactSyncHistory.slice(0, 10).map((job) => (
                    <TableRow key={job.id}>
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
                      <TableCell className="text-right font-medium tabular-nums">
                        {job.contactsUpserted ?? 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(job.startedAt)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatDuration(job.startedAt, job.completedAt)}
                      </TableCell>
                      <TableCell>
                        {job.status === "failed" && (
                          <Button
                            onClick={() => handleRetry(job.id)}
                            disabled={retryingJobId === job.id || contactSyncing}
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7 text-xs"
                          >
                            {retryingJobId === job.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3" />
                            )}
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {contactSyncHistory.some((j) => j.status === "failed" && j.errorMessage) && (
                <div className="mt-3 space-y-1">
                  {contactSyncHistory
                    .filter((j) => j.status === "failed" && j.errorMessage)
                    .slice(0, 3)
                    .map((j) => (
                      <p key={j.id} className="text-xs text-red-600 dark:text-red-400 truncate" title={j.errorMessage ?? ""}>
                        Job #{j.id}: {j.errorMessage}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} className="gap-2">
          <Save className="size-4" />
          Save to Browser
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="size-4" />
            Saved!
          </span>
        )}
      </div>
    </div>
  );
}
