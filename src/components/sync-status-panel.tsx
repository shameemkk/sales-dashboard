"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import type { SyncJob } from "@/lib/data";

export function SyncStatusPanel() {
  const [job, setJob] = useState<SyncJob | null | undefined>(undefined);
  const [retrying, setRetrying] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
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
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleRetry() {
    if (!job) return;
    setRetrying(true);
    try {
      await fetch("/api/sync/retry", {
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
      await fetch("/api/sync/manual", { method: "POST" });
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

  const syncDate = job
    ? new Date(job.startedAt).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      })
    : null;

  const barClass = isRunning ? "bg-blue-500" : hasFailures ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-2">
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

      {/* Sync button */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => (job ? setOpen((v) => !v) : handleTrigger())}
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

      {/* Dropdown panel */}
      {open && job && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-lg border bg-background shadow-lg p-3 space-y-2.5">
          {/* Header */}
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
            <div className="flex items-center gap-1.5 shrink-0">
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
              <Button
                size="sm"
                variant="ghost"
                onClick={handleTrigger}
                disabled={triggering || isRunning}
                className="h-7 w-7 p-0"
                title="Re-sync today"
              >
                <RefreshCw className={`size-3 ${triggering ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Timestamp */}
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
        </div>
      )}
    </div>
  );
}
