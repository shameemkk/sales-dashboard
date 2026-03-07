"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DailyPerformance } from "@/lib/data";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Download,
  CalendarDays,
  Mail,
  MessageSquare,
} from "lucide-react";

type SortKey = keyof DailyPerformance;
type SortDir = "asc" | "desc";

interface ColumnDef {
  key: SortKey;
  label: string;
  group: "general" | "email" | "meetings";
}

const COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", group: "general" },
  { key: "totalEmailsSent", label: "Sent", group: "email" },
  { key: "totalNewLeadsContacted", label: "New Leads", group: "email" },
  { key: "totalReplies", label: "Replies", group: "email" },
  { key: "totalPositiveReplies", label: "Positive", group: "email" },
  { key: "totalAutoFollowUpSent", label: "Follow-ups", group: "email" },
  { key: "meetingsBooked", label: "Booked", group: "meetings" },
  { key: "meetingsShowUp", label: "Showed Up", group: "meetings" },
  { key: "meetingsClosed", label: "Closed", group: "meetings" },
  { key: "meetingsNoShow", label: "No-Show", group: "meetings" },
  { key: "meetingsDisqualified", label: "Disqualified", group: "meetings" },
  { key: "meetingsCanceled", label: "Canceled", group: "meetings" },
  { key: "meetingsRescheduled", label: "Rescheduled", group: "meetings" },
];

function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
}) {
  if (sortKey !== column)
    return <ArrowUpDown className="size-3 text-muted-foreground/40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

function DayOfWeekBadge({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isWeekend
          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {day}
    </span>
  );
}


function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function DailyPerformanceTable({
  rows,
  startDate,
  endDate,
}: {
  rows: DailyPerformance[];
  startDate: string;
  endDate: string;
}) {

  const [sortKey, setSortKey] = useState<SortKey | null>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCols, setVisibleCols] = useState<Set<SortKey>>(
    () => new Set(COLUMNS.map((c) => c.key))
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  }

  function toggleCol(key: SortKey) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (key !== "date") next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const sorted = useMemo(() => {
    let data = [...rows];
    if (sortKey) {
      data.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "string" && typeof bv === "string") {
          return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDir === "asc"
          ? (av as number) - (bv as number)
          : (bv as number) - (av as number);
      });
    }
    return data;
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const col of COLUMNS) {
      if (col.key === "date") continue;
      result[col.key] = rows.reduce((s, r) => s + (r[col.key] as number), 0);
    }
    return result;
  }, [rows]);

  const activeCols = COLUMNS.filter((c) => visibleCols.has(c.key));
  const emailCols = activeCols.filter((c) => c.group === "email");
  const meetingCols = activeCols.filter((c) => c.group === "meetings");

  function formatDateForCsv(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const datePart = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    return `${datePart} ${weekday}`;
  }

  function escapeCsvCell(value: string | number): string {
    const s = String(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function exportCsv() {
    const header = activeCols.map((c) => escapeCsvCell(c.label)).join(",");
    const body = sorted
      .map((row) =>
        activeCols
          .map((c) => {
            const val =
              c.key === "date" ? formatDateForCsv(row.date) : row[c.key];
            return escapeCsvCell(val);
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-performance-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Day-by-Day Breakdown</CardTitle>
              <CardDescription>
                {rows.length} day{rows.length !== 1 ? "s" : ""} of performance
                data
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <SlidersHorizontal className="size-3.5" />
                  Columns
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-5 min-w-[20px] px-1 text-[10px]"
                  >
                    {activeCols.length - 1}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-blue-500" />
                  Email Activity
                </DropdownMenuLabel>
                {COLUMNS.filter((c) => c.group === "email").map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleCols.has(col.key)}
                    onCheckedChange={() => toggleCol(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-violet-500" />
                  Meetings
                </DropdownMenuLabel>
                {COLUMNS.filter((c) => c.group === "meetings").map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleCols.has(col.key)}
                    onCheckedChange={() => toggleCol(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={exportCsv}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            {/* Group header row */}
            {(emailCols.length > 0 || meetingCols.length > 0) && (
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className="h-7" />
                {emailCols.length > 0 && (
                  <TableHead
                    colSpan={emailCols.length}
                    className="h-7 text-center border-l border-b"
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                      <Mail className="size-3" />
                      Email Activity
                    </span>
                  </TableHead>
                )}
                {meetingCols.length > 0 && (
                  <TableHead
                    colSpan={meetingCols.length}
                    className="h-7 text-center border-l border-b"
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                      <MessageSquare className="size-3" />
                      Meetings
                    </span>
                  </TableHead>
                )}
              </TableRow>
            )}
            {/* Column header row */}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {activeCols.map((col, i) => {
                const isFirstEmail =
                  col.group === "email" && emailCols[0]?.key === col.key;
                const isFirstMeeting =
                  col.group === "meetings" && meetingCols[0]?.key === col.key;
                return (
                  <TableHead
                    key={col.key}
                    className={`cursor-pointer select-none hover:bg-muted/60 transition-colors ${
                      col.key === "date" ? "pl-6" : "text-right"
                    } ${isFirstEmail || isFirstMeeting ? "border-l" : ""}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div
                      className={`inline-flex items-center gap-1 ${
                        col.key !== "date" ? "justify-end w-full" : ""
                      }`}
                    >
                      {col.label}
                      <SortIcon
                        column={col.key}
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={activeCols.length}
                  className="py-16 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <CalendarDays className="size-8 text-muted-foreground/30" />
                    <p>No performance data for this period.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, idx) => (
                <TableRow
                  key={row.date}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  {activeCols.map((col) => {
                    const isFirstEmail =
                      col.group === "email" && emailCols[0]?.key === col.key;
                    const isFirstMeeting =
                      col.group === "meetings" &&
                      meetingCols[0]?.key === col.key;

                    if (col.key === "date") {
                      return (
                        <TableCell key={col.key} className="pl-6">
                          <div className="flex items-center gap-2.5">
                            <DayOfWeekBadge dateStr={row.date} />
                            <span className="font-medium text-sm">
                              {formatDate(row.date)}
                            </span>
                          </div>
                        </TableCell>
                      );
                    }

                    const value = row[col.key] as number;
                    return (
                      <TableCell
                        key={col.key}
                        className={`text-right tabular-nums ${
                          isFirstEmail || isFirstMeeting ? "border-l" : ""
                        }`}
                      >
                        <span className="min-w-[3ch] font-medium">
                          {value.toLocaleString()}
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>

          {sorted.length > 1 && (
            <TableFooter>
              {/* Totals */}
              <TableRow className="font-semibold bg-muted/60">
                {activeCols.map((col) => {
                  const isFirstEmail =
                    col.group === "email" && emailCols[0]?.key === col.key;
                  const isFirstMeeting =
                    col.group === "meetings" && meetingCols[0]?.key === col.key;
                  return (
                    <TableCell
                      key={col.key}
                      className={`${col.key === "date" ? "pl-6 font-bold" : "text-right tabular-nums"} ${
                        isFirstEmail || isFirstMeeting ? "border-l" : ""
                      }`}
                    >
                      {col.key === "date"
                        ? "Total"
                        : totals[col.key]?.toLocaleString() ?? ""}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
