import { supabaseBg } from "./supabase-bg";

const SEND_BASE = "https://send.uparrowagency.com/api";
const LCH_BASE = "https://services.leadconnectorhq.com";
const LCH_LOCATION_ID = "2euS49kV93yDVpJrKvZi";
const LCH_CALENDAR_ID = "w3NxjaKRulO3S0xLAVj5";

function sendHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SEND_API_TOKEN}`,
  };
}

function lchHeaders() {
  return {
    Authorization: `Bearer ${process.env.LCH_API_TOKEN}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
}

async function getCampaigns(): Promise<number[]> {
  const first = await fetch(`${SEND_BASE}/campaigns?page=1`, {
    headers: sendHeaders(),
    cache: "no-store",
  }).then((r) => r.json());

  const lastPage: number = first.meta.last_page;
  const ids: number[] = first.data.map((c: { id: number }) => c.id);

  for (let page = 2; page <= lastPage; page++) {
    const { data } = await fetch(`${SEND_BASE}/campaigns?page=${page}`, {
      headers: sendHeaders(),
      cache: "no-store",
    }).then((r) => r.json());
    ids.push(...data.map((c: { id: number }) => c.id));
  }

  return ids;
}

async function getSequenceSteps(campaignIds: number[]): Promise<number[]> {
  const stepIds: number[] = [];

  for (const id of campaignIds) {
    const { data } = await fetch(
      `${SEND_BASE}/campaigns/v1.1/${id}/sequence-steps`,
      { headers: sendHeaders(), cache: "no-store" }
    ).then((r) => r.json());

    const firstSteps = (data.sequence_steps as Array<{ id: number; order: number }>).filter(
      (s) => s.order === 1
    );
    stepIds.push(...firstSteps.map((s) => s.id));
  }

  return stepIds;
}

async function getCampaignStats(
  campaignIds: number[],
  stepIds: number[],
  startDate: string,
  endDate: string
): Promise<number> {
  const stepIdSet = new Set(stepIds);
  let totalLeadsContacted = 0;

  for (const id of campaignIds) {
    const { data } = await fetch(`${SEND_BASE}/campaigns/${id}/stats`, {
      method: "POST",
      headers: sendHeaders(),
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      cache: "no-store",
    }).then((r) => r.json());

    const filtered = (
      data.sequence_step_stats as Array<{
        sequence_step_id: number;
        leads_contacted: number;
      }>
    ).filter((s) => stepIdSet.has(s.sequence_step_id));

    totalLeadsContacted += filtered.reduce((sum, s) => sum + s.leads_contacted, 0);
  }

  return totalLeadsContacted;
}

async function getWorkspacesStats(
  startDate: string,
  endDate: string
): Promise<{ emails_sent: number; replies: number; positive_replies: number }> {
  const { data } = await fetch(
    `${SEND_BASE}/workspaces/v1.1/stats?start_date=${startDate}&end_date=${endDate}`,
    { headers: sendHeaders(), cache: "no-store" }
  ).then((r) => r.json());

  return {
    emails_sent: data.emails_sent ?? 0,
    replies: data.unique_replies_per_contact ?? 0,
    positive_replies: data.interested ?? 0,
  };
}


async function getClosedMeetingCount(date: string): Promise<number> {
  const [year, month, day] = date.split("-");
  const formattedDate = `${month}-${day}-${year}`;

  const url = new URL(`${LCH_BASE}/opportunities/search`);
  url.searchParams.set("location_id", LCH_LOCATION_ID);
  url.searchParams.set("date", formattedDate);
  url.searchParams.set("status", "won");

  const data = await fetch(url.toString(), {
    headers: lchHeaders(),
    cache: "no-store",
  }).then((r) => r.json());

  return data.meta?.total ?? data.total ?? 0;
}

async function getCalendarEventStats(date: string): Promise<{
  booked: number;
  cancelled: number;
  noshow: number;
  showed: number;
  rescheduled: number;
  disqualified: number;
}> {
  const startTime = new Date(date + "T00:00:00-04:00").getTime();
  const endTime = new Date(date + "T23:59:59.999-04:00").getTime();

  const url = new URL(`${LCH_BASE}/calendars/events`);
  url.searchParams.set("locationId", LCH_LOCATION_ID);
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));
  url.searchParams.set("calendarId", LCH_CALENDAR_ID);

  const { events = [] } = await fetch(url.toString(), {
    headers: { ...lchHeaders(), Version: "2021-04-15" },
    cache: "no-store",
  }).then((r) => r.json());

  const result = {
    booked: 0,
    cancelled: 0,
    noshow: 0,
    showed: 0,
    rescheduled: 0,
    disqualified: 0,
  };

  for (const e of events as Array<{ appointmentStatus?: string }>) {
    switch ((e.appointmentStatus ?? "").toLowerCase()) {
      case "confirmed":   result.booked++;       break;
      case "cancelled":   result.cancelled++;    break;
      case "noshow":
      case "no-show":     result.noshow++;       break;
      case "showed":      result.showed++;       break;
      case "rescheduled": result.rescheduled++;  break;
      case "invalid":     result.disqualified++; break;
    }
  }

  return result;
}

async function getMarkedBookingCount(date: string): Promise<number> {
  const startTime = new Date(date + "T00:00:00-04:00").getTime();
  // endTime = 1 month from end of day
  const endOfDay = new Date(date + "T23:59:59.999-04:00");
  const endTime = new Date(endOfDay);
  endTime.setMonth(endTime.getMonth() + 1);

  const url = new URL(`${LCH_BASE}/calendars/events`);
  url.searchParams.set("locationId", LCH_LOCATION_ID);
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime.getTime()));
  url.searchParams.set("calendarId", LCH_CALENDAR_ID);

  const { events = [] } = await fetch(url.toString(), {
    headers: { ...lchHeaders(), Version: "2021-04-15" },
    cache: "no-store",
  }).then((r) => r.json());

  // Count confirmed events whose dateAdded falls on `date`
  let count = 0;
  for (const e of events as Array<{ appointmentStatus?: string; dateAdded?: string }>) {
    if ((e.appointmentStatus ?? "").toLowerCase() !== "confirmed") continue;
    if (!e.dateAdded) continue;
    const addedDate = e.dateAdded.slice(0, 10); // "YYYY-MM-DD"
    if (addedDate === date) count++;
  }

  return count;
}

export interface PerformanceSyncResult {
  date: string;
  total_emails_sent: number;
  total_new_leads_contacted: number;
  total_replies: number;
  total_positive_replies: number;
  meetings_booked: number;
  meetings_no_show: number;
  meetings_show_up: number;
  meetings_disqualified: number;
  meetings_canceled: number;
  meetings_rescheduled: number;
  meetings_closed: number;
  marked_booking: number;
}

export async function runPerformanceSync(
  startDate: string,
  endDate: string
): Promise<PerformanceSyncResult[]> {
  // Fetch campaign/step data once (shared across all days)
  const [workspaceStats, campaignIds] = await Promise.all([
    getWorkspacesStats(startDate, endDate),
    getCampaigns(),
  ]);

  const stepIds = await getSequenceSteps(campaignIds);

  const newLeadsContacted = await getCampaignStats(
    campaignIds,
    stepIds,
    startDate,
    endDate
  );

  // Per-day calendar/meeting stats — iterate each day in the range
  const days = getDaysInRange(startDate, endDate);
  const perDayStats = await Promise.all(
    days.map(async (date) => {
      const [closed, calendar, markedBooking] = await Promise.all([
        getClosedMeetingCount(date),
        getCalendarEventStats(date),
        getMarkedBookingCount(date),
      ]);
      return { date, closed, calendar, markedBooking };
    })
  );

  const rows: PerformanceSyncResult[] = perDayStats.map(({ date, closed, calendar, markedBooking }) => ({
    date,
    total_emails_sent: workspaceStats.emails_sent,
    total_new_leads_contacted: newLeadsContacted,
    total_replies: workspaceStats.replies,
    total_positive_replies: workspaceStats.positive_replies,
    meetings_booked: calendar.booked,
    meetings_no_show: calendar.noshow,
    meetings_show_up: calendar.showed,
    meetings_disqualified: calendar.disqualified,
    meetings_canceled: calendar.cancelled,
    meetings_rescheduled: calendar.rescheduled,
    meetings_closed: closed,
    marked_booking: markedBooking,
  }));

  // Upsert into daily_performance
  const { error } = await supabaseBg
    .from("daily_performance")
    .upsert(rows, { onConflict: "date" });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

  return rows;
}

function getDaysInRange(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const current = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  while (current <= end) {
    days.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}
