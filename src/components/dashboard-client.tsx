"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DailyPerformance } from "@/components/daily-performance";
import { DateRangePicker } from "@/components/date-picker";

export function DashboardClient() {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  return (
    <DailyPerformance
      startDate={format(startDate, "yyyy-MM-dd")}
      endDate={format(endDate, "yyyy-MM-dd")}
      action={
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      }
    />
  );
}
