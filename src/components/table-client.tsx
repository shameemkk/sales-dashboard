"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { DailyPerformanceTable } from "@/components/daily-performance-table";
import { DateRangePicker } from "@/components/date-picker";
import { fetchDailyPerformanceRows } from "@/lib/supabase-data";
import type { DailyPerformance } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";

interface TableClientProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (d: Date) => void;
  onEndDateChange: (d: Date) => void;
}

export function TableClient({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: TableClientProps) {
  const [rows, setRows] = useState<DailyPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDailyPerformanceRows(start, end)
      .then((data) => {
        if (!cancelled) {
          setRows(data);
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

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 py-5 md:px-8 border-b">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Performance Table
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {start !== end
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
        <div className="px-6 py-6 md:px-8">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : error ? (
        <p className="px-6 py-4 md:px-8 text-sm text-destructive">{error}</p>
      ) : (
        <div className="px-4 py-4">
          <DailyPerformanceTable rows={rows} startDate={start} endDate={end} />
        </div>
      )}
    </>
  );
}
