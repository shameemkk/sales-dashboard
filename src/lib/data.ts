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

export interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  dateAdded: string | null;
  notes: string | null;
  opportunityId: string | null;
  syncedAt: string | null;
  enriched: boolean;
  firstDialTime: string | null;
  firstTextTime: string | null;
}

export type SyncType = "contact_sync" | "performance_sync" | "email_analyzer_sync";
export type SyncTrigger = "manual" | "scheduled" | "retry";

export interface SyncSchedule {
  id: number;
  type: SyncType;
  enabled: boolean;
  timeUtc: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncExecutionLog {
  id: number;
  scheduleId: number | null;
  type: SyncType;
  trigger: SyncTrigger;
  status: "queued" | "running" | "completed" | "failed";
  errorMessage: string | null;
  contactsFetched: number | null;
  contactsUpserted: number | null;
  syncDate: string | null;
  rowsSynced: number | null;
  retryCount: number;
  startedAt: string;
  completedAt: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  hasToken: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmailPerformance {
  id: number;
  workspaceId: string;
  workspaceName: string | null;
  senderId: string;
  email: string;
  domain: string;
  totalSent: number;
  totalReplies: number;
  replyRate: number;
  totalBounced: number;
  bounceRate: number;
  warmupScore: number;
  tags: Tag[];
  status: string | null;
  syncedAt: string;
}

export interface DomainPerformance {
  domain: string;
  totalEmails: number;
  avgWarmupScore: number;
  avgReplyRate: number;
  avgBounceRate: number;
}

