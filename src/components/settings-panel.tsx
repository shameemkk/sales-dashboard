"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, CalendarDays, Save, CheckCircle2 } from "lucide-react";
import { getDefaultCols, getDefaultTableDays, saveDefaultCols, saveDefaultTableDays } from "@/lib/settings";

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

export function SettingsPanel() {
  const [cols, setCols] = useState<Set<string>>(() => getDefaultCols());
  const [days, setDays] = useState<number>(() => getDefaultTableDays());
  const [saved, setSaved] = useState(false);

  function toggle(key: string) {
    setCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
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
