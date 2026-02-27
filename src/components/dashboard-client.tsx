"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { DailyPerformance } from "@/components/daily-performance";
import { DateRangePicker } from "@/components/date-picker";
import { fetchDailyPerformanceForRange } from "@/lib/supabase-data";
import type { DailyPerformance as DailyPerformanceData } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";

function getPrevRange(startDate: string, endDate: string) {
  const prevStart = new Date(startDate + "T00:00:00");
  const prevEnd = new Date(endDate + "T00:00:00");
  const rangeDays =
    Math.round(
      (prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
  prevStart.setDate(prevStart.getDate() - rangeDays);
  prevEnd.setDate(prevEnd.getDate() - rangeDays);
  return {
    prevStartStr: prevStart.toISOString().split("T")[0],
    prevEndStr: prevEnd.toISOString().split("T")[0],
  };
}

interface DashboardClientProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (d: Date) => void;
  onEndDateChange: (d: Date) => void;
}

export function DashboardClient({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DashboardClientProps) {
  const [data, setData] = useState<DailyPerformanceData | null>(null);
  const [prev, setPrev] = useState<DailyPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const { prevStartStr, prevEndStr } = getPrevRange(start, end);

    Promise.all([
      fetchDailyPerformanceForRange(start, end),
      fetchDailyPerformanceForRange(prevStartStr, prevEndStr),
    ])
      .then(([current, previous]) => {
        if (!cancelled) {
          setData(current);
          setPrev(previous);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message ?? "Failed to load data");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const isRange = start !== end;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isRange ? "Performance Summary" : "Daily Performance"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRange
              ? `${new Date(start + "T00:00:00").toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })} – ${new Date(end + "T00:00:00").toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`
              : new Date(start + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
          </p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
        />
      </div>

      {loading ? (
        <div className="space-y-8">
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data && prev ? (
        <DailyPerformance data={data} prev={prev} isRange={isRange} />
      ) : null}
    </>
  );
}
