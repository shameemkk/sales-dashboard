export interface Tag {
  id: number;
  name: string;
}

export interface DailyPerformance {
  date: string;
  totalEmailsSent: number;
  totalNewLeadsContacted: number;
  totalReplies: number;
  totalPositiveReplies: number;
  todayAppointments: number;
  meetingsNoShow: number;
  meetingsShowUp: number;
  meetingsDisqualified: number;
  meetingsCanceled: number;
  meetingsRescheduled: number;
  meetingsClosed: number;
  bookings: number;
}

export interface EmailAccount {
  id: string;
  email: string;
  totalEmailsSent: number;
  totalReplies: number;
  replyRate: number;
  totalWarmupsSent: number;
  warmupEnabled: boolean;
  dailyLimit: number;
  status: "active" | "inactive" | "warming";
  tags: string[];
}

export interface AccountDailyStat {
  sender_id: number;
  stat_date: string; // "YYYY-MM-DD"
  sent: number;
  replied: number;
  total_opens: number;
  unique_opens: number;
  unsubscribed: number;
  bounced: number;
  interested: number;
}

export interface SyncJob {
  id: number;
  statDate: string;
  status: "running" | "completed" | "failed";
  totalPages: number | null;
  completedPages: number;
  failedPages: { page: number; error: string }[];
  startedAt: string;
  completedAt: string | null;
}

