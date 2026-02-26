"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { DailyPerformanceTable } from "@/components/daily-performance-table";
import { DateRangePicker } from "@/components/date-picker";

export function TableClient() {
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(subDays(today, 6));
  const [endDate, setEndDate] = useState<Date>(today);

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
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
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>
      <DailyPerformanceTable startDate={start} endDate={end} />
    </>
  );
}
