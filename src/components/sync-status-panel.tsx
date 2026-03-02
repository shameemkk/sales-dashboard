"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, Play } from "lucide-react";
import type { SyncJob } from "@/lib/data";

export function SyncStatusPanel() {
  // undefined = initial loading, null = no job yet, SyncJob = has data
  const [job, setJob] = useState<SyncJob | null | undefined>(undefined);
  const [retrying, setRetrying] = useState(false);
  const [triggering, setTriggering] = useState(false);

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

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll every 5s while running
  useEffect(() => {
    if (job?.status !== "running") return;
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [job?.status, fetchStatus]);

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

  async function handleManualTrigger() {
    setTriggering(true);
    try {
      await fetch("/api/sync/manual", { method: "POST" });
      await fetchStatus();
    } finally {
      setTriggering(false);
    }
  }

  // Initial loading — render nothing
  if (job === undefined) return null;

  // No sync run yet
  if (job === null) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between py-3 px-4">
          <p className="text-sm text-muted-foreground">
            No sync run yet — trigger via n8n or manually
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualTrigger}
            disabled={triggering}
            className="h-8 gap-1.5 text-xs"
          >
            {triggering ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Run Sync
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pct =
    job.totalPages && job.totalPages > 0
      ? Math.round((job.completedPages / job.totalPages) * 100)
      : 0;
  const failedCount = job.failedPages.length;
  const isRunning = job.status === "running";
  const hasFailures = failedCount > 0;

  const borderClass = isRunning
    ? "border-blue-500/30 bg-blue-500/5"
    : hasFailures
    ? "border-amber-500/30 bg-amber-500/5"
    : "border-emerald-500/30 bg-emerald-500/5";

  const barClass = isRunning
    ? "bg-blue-500"
    : hasFailures
    ? "bg-amber-500"
    : "bg-emerald-500";

  const syncDate = new Date(job.startedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <Card className={borderClass}>
      <CardContent className="py-3 px-4 space-y-2">
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
            <span className="text-sm font-medium truncate">
              Sync {job.statDate}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {syncDate}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={
                isRunning
                  ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
                  : hasFailures
                  ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                  : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              }
            >
              {isRunning ? "Running" : hasFailures ? "Partial" : "Completed"}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleManualTrigger}
              disabled={triggering || isRunning}
              className="h-7 w-7 p-0"
              title="Re-sync today"
            >
              <RefreshCw className={`size-3 ${triggering ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

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
              {job.completedPages.toLocaleString()} /{" "}
              {job.totalPages.toLocaleString()} pages synced · {pct}%
            </p>
          </div>
        )}

        {/* Failed pages row */}
        {hasFailures && (
          <div className="flex items-center justify-between rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 gap-2">
            <p className="text-xs text-amber-700 dark:text-amber-400 truncate">
              {failedCount} page{failedCount > 1 ? "s" : ""} failed:{" "}
              {job.failedPages
                .filter((f) => f.page > 0)
                .slice(0, 6)
                .map((f) => f.page)
                .join(", ")}
              {failedCount > 6 ? ` +${failedCount - 6} more` : ""}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              disabled={retrying || isRunning}
              className="h-7 shrink-0 gap-1 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              {retrying ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Retry Failed
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
