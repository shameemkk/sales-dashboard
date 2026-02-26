"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
}

function SingleDatePicker({
  date,
  onDateChange,
  label,
  maxDate,
  minDate,
}: {
  date: Date;
  onDateChange: (date: Date) => void;
  label: string;
  maxDate?: Date;
  minDate?: Date;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[160px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MMM d, yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onDateChange(d)}
          initialFocus
          disabled={(d) => {
            if (d > new Date()) return true;
            if (maxDate && d > maxDate) return true;
            if (minDate && d < minDate) return true;
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <SingleDatePicker
        date={startDate}
        onDateChange={onStartDateChange}
        label="Start date"
        maxDate={endDate}
      />
      <span className="text-sm text-muted-foreground">to</span>
      <SingleDatePicker
        date={endDate}
        onDateChange={onEndDateChange}
        label="End date"
        minDate={startDate}
      />
    </div>
  );
}
