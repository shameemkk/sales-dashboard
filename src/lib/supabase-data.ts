import { supabase } from "./supabase";
import type { DailyPerformance } from "./data";

type DbRow = Record<string, unknown>;

function mapRow(row: DbRow): DailyPerformance {
  return {
    date: row.date as string,
    totalEmailsSent: (row.total_emails_sent as number) ?? 0,
    totalNewLeadsContacted: (row.total_new_leads_contacted as number) ?? 0,
    totalReplies: (row.total_replies as number) ?? 0,
    totalPositiveReplies: (row.total_positive_replies as number) ?? 0,
    totalAutoFollowUpSent: (row.total_auto_follow_up_sent as number) ?? 0,
    meetingsBooked: (row.meetings_booked as number) ?? 0,
    meetingsNoShow: (row.meetings_no_show as number) ?? 0,
    meetingsShowUp: (row.meetings_show_up as number) ?? 0,
    meetingsDisqualified: (row.meetings_disqualified as number) ?? 0,
    meetingsCanceled: (row.meetings_canceled as number) ?? 0,
    meetingsRescheduled: (row.meetings_rescheduled as number) ?? 0,
    meetingsClosed: (row.meetings_closed as number) ?? 0,
  };
}

function zeroPerformance(date: string): DailyPerformance {
  return {
    date,
    totalEmailsSent: 0,
    totalNewLeadsContacted: 0,
    totalReplies: 0,
    totalPositiveReplies: 0,
    totalAutoFollowUpSent: 0,
    meetingsBooked: 0,
    meetingsNoShow: 0,
    meetingsShowUp: 0,
    meetingsDisqualified: 0,
    meetingsCanceled: 0,
    meetingsRescheduled: 0,
    meetingsClosed: 0,
  };
}

function sumRows(rows: DailyPerformance[], dateLabel: string): DailyPerformance {
  const totals = zeroPerformance(dateLabel);
  for (const r of rows) {
    totals.totalEmailsSent += r.totalEmailsSent;
    totals.totalNewLeadsContacted += r.totalNewLeadsContacted;
    totals.totalReplies += r.totalReplies;
    totals.totalPositiveReplies += r.totalPositiveReplies;
    totals.totalAutoFollowUpSent += r.totalAutoFollowUpSent;
    totals.meetingsBooked += r.meetingsBooked;
    totals.meetingsNoShow += r.meetingsNoShow;
    totals.meetingsShowUp += r.meetingsShowUp;
    totals.meetingsDisqualified += r.meetingsDisqualified;
    totals.meetingsCanceled += r.meetingsCanceled;
    totals.meetingsRescheduled += r.meetingsRescheduled;
    totals.meetingsClosed += r.meetingsClosed;
  }
  return totals;
}

// Module-level caches — survive tab switches, cleared on page refresh
const rowsCache = new Map<string, DailyPerformance[]>();
const rangeCache = new Map<string, DailyPerformance>();
// In-flight promise deduplication — prevents parallel fetches for the same key
const rowsInFlight = new Map<string, Promise<DailyPerformance[]>>();
const rangeInFlight = new Map<string, Promise<DailyPerformance>>();

export async function fetchDailyPerformanceRows(
  startDate: string,
  endDate: string
): Promise<DailyPerformance[]> {
  const key = `${startDate}:${endDate}`;
  if (rowsCache.has(key)) return rowsCache.get(key)!;
  if (rowsInFlight.has(key)) return rowsInFlight.get(key)!;

  const promise = Promise.resolve(
    supabase
      .from("daily_performance")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        rowsInFlight.delete(key);
        if (error) throw new Error(error.message);
        const rows = (data ?? []).map(mapRow);
        rowsCache.set(key, rows);
        return rows;
      })
  );

  rowsInFlight.set(key, promise);
  return promise;
}

export async function fetchDailyPerformanceByDate(
  date: string
): Promise<DailyPerformance> {
  const key = date;
  if (rangeCache.has(key)) return rangeCache.get(key)!;
  if (rangeInFlight.has(key)) return rangeInFlight.get(key)!;

  const promise = Promise.resolve(
    supabase
      .from("daily_performance")
      .select("*")
      .eq("date", date)
      .maybeSingle()
      .then(({ data, error }) => {
        rangeInFlight.delete(key);
        if (error) throw new Error(error.message);
        const result = data ? mapRow(data as DbRow) : zeroPerformance(date);
        rangeCache.set(key, result);
        return result;
      })
  );

  rangeInFlight.set(key, promise);
  return promise;
}

export async function fetchDailyPerformanceForRange(
  startDate: string,
  endDate: string
): Promise<DailyPerformance> {
  if (startDate === endDate) return fetchDailyPerformanceByDate(startDate);

  const key = `${startDate}:${endDate}`;
  if (rangeCache.has(key)) return rangeCache.get(key)!;
  if (rangeInFlight.has(key)) return rangeInFlight.get(key)!;

  const promise = fetchDailyPerformanceRows(startDate, endDate).then((rows) => {
    const result = sumRows(rows, `${startDate} – ${endDate}`);
    rangeCache.set(key, result);
    return result;
  });

  rangeInFlight.set(key, promise);
  return promise;
}
