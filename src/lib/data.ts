export interface DailyPerformance {
  date: string;
  totalEmailsSent: number;
  totalNewLeadsContacted: number;
  totalReplies: number;
  totalPositiveReplies: number;
  totalAutoFollowUpSent: number;
  meetingsBooked: number;
  meetingsNoShow: number;
  meetingsShowUp: number;
  meetingsDisqualified: number;
  meetingsCanceled: number;
  meetingsRescheduled: number;
  meetingsClosed: number;
}

export interface EmailAccount {
  id: string;
  email: string;
  totalEmailsSent: number;
  totalReplies: number;
  replyRate: number;
  totalWarmupsSent: number;
  status: "active" | "inactive" | "warming";
}

export const dailyPerformance: DailyPerformance = {
  date: "2026-02-25",
  totalEmailsSent: 1248,
  totalNewLeadsContacted: 342,
  totalReplies: 187,
  totalPositiveReplies: 64,
  totalAutoFollowUpSent: 893,
  meetingsBooked: 28,
  meetingsNoShow: 4,
  meetingsShowUp: 19,
  meetingsDisqualified: 3,
  meetingsCanceled: 2,
  meetingsRescheduled: 6,
  meetingsClosed: 12,
};

// Deterministic pseudo-random seeded by date so the same date always
// returns the same numbers across renders.
function seededRand(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

export function getDailyPerformanceByDate(date: string): DailyPerformance {
  const s = (suffix: string) => `${date}-${suffix}`;
  const emails   = seededRand(s("emails"),   800,  1800);
  const leads    = seededRand(s("leads"),    200,   500);
  const replies  = seededRand(s("replies"),   80,   300);
  const positive = seededRand(s("positive"),  20,  Math.min(replies, 120));
  const followup = seededRand(s("followup"), 400,  1200);
  const booked   = seededRand(s("booked"),    10,    45);
  const noshow   = seededRand(s("noshow"),     1,     8);
  const showup   = seededRand(s("showup"),     5,  Math.max(5, booked - noshow));
  const disq     = seededRand(s("disq"),       0,     5);
  const canceled = seededRand(s("canceled"),   0,     5);
  const reschd   = seededRand(s("reschd"),     1,    10);
  const closed   = seededRand(s("closed"),     3,  Math.max(4, showup - disq));

  return {
    date,
    totalEmailsSent:       emails,
    totalNewLeadsContacted: leads,
    totalReplies:          replies,
    totalPositiveReplies:  positive,
    totalAutoFollowUpSent: followup,
    meetingsBooked:        booked,
    meetingsNoShow:        noshow,
    meetingsShowUp:        showup,
    meetingsDisqualified:  disq,
    meetingsCanceled:      canceled,
    meetingsRescheduled:   reschd,
    meetingsClosed:        closed,
  };
}

export function getDailyPerformanceByDateRange(
  startDate: string,
  endDate: string
): DailyPerformance {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  if (start.getTime() === end.getTime()) {
    return getDailyPerformanceByDate(startDate);
  }

  const totals: DailyPerformance = {
    date: `${startDate} – ${endDate}`,
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

  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().split("T")[0];
    const day = getDailyPerformanceByDate(dateStr);
    totals.totalEmailsSent += day.totalEmailsSent;
    totals.totalNewLeadsContacted += day.totalNewLeadsContacted;
    totals.totalReplies += day.totalReplies;
    totals.totalPositiveReplies += day.totalPositiveReplies;
    totals.totalAutoFollowUpSent += day.totalAutoFollowUpSent;
    totals.meetingsBooked += day.meetingsBooked;
    totals.meetingsNoShow += day.meetingsNoShow;
    totals.meetingsShowUp += day.meetingsShowUp;
    totals.meetingsDisqualified += day.meetingsDisqualified;
    totals.meetingsCanceled += day.meetingsCanceled;
    totals.meetingsRescheduled += day.meetingsRescheduled;
    totals.meetingsClosed += day.meetingsClosed;
    cursor.setDate(cursor.getDate() + 1);
  }

  return totals;
}

export function getDailyPerformanceRows(
  startDate: string,
  endDate: string
): DailyPerformance[] {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const rows: DailyPerformance[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = cursor.toISOString().split("T")[0];
    rows.push(getDailyPerformanceByDate(dateStr));
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

export const emailAccounts: EmailAccount[] = [
  {
    id: "1",
    email: "outreach@acmecorp.com",
    totalEmailsSent: 4821,
    totalReplies: 612,
    replyRate: 12.7,
    totalWarmupsSent: 340,
    status: "active",
  },
  {
    id: "2",
    email: "sales@acmecorp.com",
    totalEmailsSent: 3204,
    totalReplies: 481,
    replyRate: 15.0,
    totalWarmupsSent: 200,
    status: "active",
  },
  {
    id: "3",
    email: "hello@startup.io",
    totalEmailsSent: 1890,
    totalReplies: 203,
    replyRate: 10.7,
    totalWarmupsSent: 510,
    status: "warming",
  },
  {
    id: "4",
    email: "contact@bizdev.co",
    totalEmailsSent: 2650,
    totalReplies: 318,
    replyRate: 12.0,
    totalWarmupsSent: 150,
    status: "active",
  },
  {
    id: "5",
    email: "grow@ventures.com",
    totalEmailsSent: 987,
    totalReplies: 89,
    replyRate: 9.0,
    totalWarmupsSent: 420,
    status: "warming",
  },
  {
    id: "6",
    email: "reach@partners.net",
    totalEmailsSent: 512,
    totalReplies: 34,
    replyRate: 6.6,
    totalWarmupsSent: 600,
    status: "warming",
  },
  {
    id: "7",
    email: "deals@salesforce.biz",
    totalEmailsSent: 3810,
    totalReplies: 570,
    replyRate: 15.0,
    totalWarmupsSent: 100,
    status: "active",
  },
  {
    id: "8",
    email: "connect@leadgen.io",
    totalEmailsSent: 0,
    totalReplies: 0,
    replyRate: 0,
    totalWarmupsSent: 0,
    status: "inactive",
  },
];
