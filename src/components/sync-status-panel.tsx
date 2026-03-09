"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  History,
  CalendarDays,
} from "lucide-react";
import type { SyncJob } from "@/lib/data";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function HistoryItem({ job }: { job: SyncJob }) {
  const hasFailures = job.failedPages.length > 0;
  const isRunning = job.status === "running";
  const pct =
    job.totalPages && job.totalPages > 0
      ? Math.round((job.completedPages / job.totalPages) * 100)
      : null;

  return (
    <div className="flex items-start gap-2.5 py-2 px-1">
      <div className="mt-0.5 shrink-0">
        {isRunning ? (
          <Loader2 className="size-3.5 animate-spin text-blue-500" />
        ) : hasFailures ? (
          <AlertTriangle className="size-3.5 text-amber-500" />
        ) : (
          <CheckCircle2 className="size-3.5 text-emerald-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">{job.statDate}</span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${
              isRunning
                ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
                : hasFailures
                ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isRunning ? "Running" : hasFailures ? "Partial" : "Done"}
          </Badge>
        </div>
        {pct !== null && (
          <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
            {job.completedPages}/{job.totalPages} pages · {pct}%
            {hasFailures && (
              <span className="text-amber-600 dark:text-amber-400">
                {" "}· {job.failedPages.length} failed
              </span>
            )}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {formatDateTime(job.startedAt)}
        </p>
      </div>
    </div>
  );
}

function SyncHistoryPopover() {
  const [history, setHistory] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calOpen, setCalOpen] = useState(false);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch("/api/account-sync/history");
      if (!res.ok) return;
      const data: SyncJob[] = await res.json();
      setHistory(data);
    } finally {
      setLoading(false);
    }
  }

  const dateFilter = selectedDate
    ? selectedDate.toLocaleDateString("en-CA")
    : "";

  const filtered = dateFilter
    ? history.filter((h) => h.statDate === dateFilter)
    : history;

  const syncedDates = history.map((h) => new Date(h.statDate + "T00:00:00"));

  return (
    <Popover onOpenChange={(open) => { if (open) fetchHistory(); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Sync history">
          <History className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b flex items-center justify-between">
          <p className="text-xs font-semibold">Sync History</p>
          <div className="flex items-center gap-2">
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(undefined)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            {/* Calendar popup for date filter */}
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  title="Filter by date"
                  className={`rounded p-1 transition-colors ${
                    selectedDate
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <CalendarDays className="size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="left" align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => { setSelectedDate(d); setCalOpen(false); }}
                  disabled={{ after: new Date() }}
                  captionLayout="dropdown"
                  modifiers={{ synced: syncedDates }}
                  modifiersClassNames={{
                    synced: "[&>button]:after:absolute [&>button]:after:bottom-0.5 [&>button]:after:left-1/2 [&>button]:after:-translate-x-1/2 [&>button]:after:size-1 [&>button]:after:rounded-full [&>button]:after:bg-primary",
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active filter label */}
        {selectedDate && (
          <div className="px-3 py-1.5 border-b bg-primary/5">
            <p className="text-[11px] text-primary font-medium">
              Showing: {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        )}

        {/* History list */}
        <div className="divide-y divide-border/50 max-h-64 overflow-y-auto px-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {dateFilter ? "No syncs for this date." : "No sync history."}
            </p>
          ) : (
            filtered.map((h) => <HistoryItem key={h.id} job={h} />)
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SyncStatusPanel() {
  const [job, setJob] = useState<SyncJob | null | undefined>(undefined);
  const [retrying, setRetrying] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualDate, setManualDate] = useState<Date>(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const manualDateStr = manualDate.toLocaleDateString("en-CA"); // YYYY-MM-DD

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/account-sync/status");
      if (!res.ok) return;
      const data: SyncJob | null = await res.json();
      setJob(data);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (job?.status !== "running") return;
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [job?.status, fetchStatus]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Don't close if the click landed inside a Radix portal (e.g. calendar popup)
        const inPortal = (e.target as Element).closest?.("[data-radix-popper-content-wrapper]");
        if (!inPortal) setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleRetry() {
    if (!job) return;
    setRetrying(true);
    try {
      await fetch("/api/account-sync/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id }),
      });
      await fetchStatus();
    } finally {
      setRetrying(false);
    }
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      await fetch("/api/account-sync/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stat_date: manualDateStr }),
      });
      await fetchStatus();
      setOpen(true);
    } finally {
      setTriggering(false);
    }
  }

  if (job === undefined) return null;

  const isRunning = job?.status === "running";
  const hasFailures = (job?.failedPages?.length ?? 0) > 0;
  const failedCount = job?.failedPages?.length ?? 0;
  const pct =
    job?.totalPages && job.totalPages > 0
      ? Math.round((job.completedPages / job.totalPages) * 100)
      : 0;

  const syncDate = job ? formatDateTime(job.startedAt) : null;
  const barClass = isRunning ? "bg-blue-500" : hasFailures ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1.5">
      {/* Running pill */}
      {isRunning && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
          <Loader2 className="size-3 animate-spin" />
          Running
        </span>
      )}

      {/* Last sync hint when closed */}
      {!open && !isRunning && job && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {hasFailures ? (
            <><AlertTriangle className="size-3 text-amber-500" /><span className="text-amber-600 dark:text-amber-400">Partial · {job.statDate}</span></>
          ) : (
            <><CheckCircle2 className="size-3 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Synced · {job.statDate}</span></>
          )}
        </span>
      )}

      {/* History icon popover */}
      <SyncHistoryPopover />

      {/* Sync button */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        disabled={triggering}
        className="h-8 gap-1.5 text-xs"
      >
        {triggering ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <RefreshCw className="size-3" />
        )}
        Sync
        {job && (
          <ChevronDown
            className={`size-3 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </Button>

      {/* Sync dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-lg border bg-background shadow-lg p-3 space-y-2.5">

          {/* Current job status */}
          {job && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {isRunning ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-blue-500" />
                  ) : hasFailures ? (
                    <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  )}
                  <span className="text-sm font-medium">Sync {job.statDate}</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    isRunning
                      ? "border-blue-500/30 text-blue-600 dark:text-blue-400 text-[11px]"
                      : hasFailures
                      ? "border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px]"
                      : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px]"
                  }
                >
                  {isRunning ? "Running" : hasFailures ? "Partial" : "Completed"}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground">{syncDate}</p>

              {/* Progress bar */}
              {job.totalPages !== null && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {job.completedPages.toLocaleString()} / {job.totalPages.toLocaleString()} pages · {pct}%
                  </p>
                </div>
              )}

              {/* Failed pages */}
              {hasFailures && (
                <div className="flex items-center justify-between rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 gap-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400 truncate">
                    {failedCount} page{failedCount > 1 ? "s" : ""} failed:{" "}
                    {job.failedPages.filter((f) => f.page > 0).slice(0, 5).map((f) => f.page).join(", ")}
                    {failedCount > 5 ? ` +${failedCount - 5} more` : ""}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    disabled={retrying || isRunning}
                    className="h-7 shrink-0 gap-1 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    {retrying ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                    Retry
                  </Button>
                </div>
              )}

              <div className="border-t" />
            </>
          )}

          {/* Manual date sync */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sync a date</p>
            <div className="flex items-center gap-2">
              {/* Date display + calendar popup */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex-1 h-8 flex items-center gap-2 rounded-md border bg-background px-2.5 text-xs hover:bg-muted/50 transition-colors">
                    <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium">
                      {manualDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={manualDate}
                    onSelect={(d) => { if (d) setManualDate(d); }}
                    disabled={{ after: new Date() }}
                    captionLayout="dropdown"
                  />
                </PopoverContent>
              </Popover>
              <Button
                size="sm"
                onClick={handleTrigger}
                disabled={triggering || isRunning}
                className="h-8 gap-1.5 text-xs shrink-0"
              >
                {triggering ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Run
              </Button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
