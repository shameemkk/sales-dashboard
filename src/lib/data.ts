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
  warmupEnabled: boolean;
  dailyLimit: number;
  status: "active" | "inactive" | "warming";
  tags: string[];
}

