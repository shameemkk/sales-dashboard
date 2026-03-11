"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyPerformance as DailyPerformanceData } from "@/lib/data";
import { AnimatedCounter } from "@/components/animated-counter";
import { MeetingFunnel } from "@/components/meeting-funnel";
import { Mail, Users, MessageSquare, ThumbsUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  rate?: string;
  rateLabel?: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  bgColor = "bg-primary/10",
  rate,
  rateLabel,
}: StatCardProps) {
  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={`${bgColor} rounded-lg p-2 transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          <AnimatedCounter value={value} />
        </div>
        {rate !== undefined && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{rate}%</span>
            {rateLabel && <span> {rateLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DailyPerformance({
  data,
}: {
  data: DailyPerformanceData;
  prev: DailyPerformanceData;
  isRange: boolean;
}) {

  const emailStats = [
    {
      title: "Emails Sent",
      value: data.totalEmailsSent,
      icon: Mail,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "New Leads",
      value: data.totalNewLeadsContacted,
      icon: Users,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "Replies",
      value: data.totalReplies,
      icon: MessageSquare,
      iconColor: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      rate: data.totalNewLeadsContacted > 0
        ? ((data.totalReplies / data.totalNewLeadsContacted) * 100).toFixed(1)
        : "0.0",
      rateLabel: "reply %",
    },
    {
      title: "Positive Replies",
      value: data.totalPositiveReplies,
      icon: ThumbsUp,
      iconColor: "text-green-500",
      bgColor: "bg-green-500/10",
      rate: data.totalReplies > 0
        ? ((data.totalPositiveReplies / data.totalReplies) * 100).toFixed(1)
        : "0.0",
      rateLabel: "positive %",
    },
  ];

  const replyRate =
    data.totalNewLeadsContacted > 0
      ? ((data.totalReplies / data.totalNewLeadsContacted) * 100).toFixed(1)
      : "0.0";
  const positiveRate =
    data.totalReplies > 0
      ? ((data.totalPositiveReplies / data.totalReplies) * 100).toFixed(0)
      : "0";

  return (
    <div className="space-y-8">
      {/* Quick KPI Banner */}
      <div className="rounded-xl border bg-linear-to-r from-blue-500/5 via-violet-500/5 to-emerald-500/5 dark:from-blue-500/10 dark:via-violet-500/10 dark:to-emerald-500/10 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div className="flex items-center gap-2.5">
            <div className="size-2 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
            <span className="text-muted-foreground">Reply Rate</span>
            <span className="font-bold text-base tabular-nums">{replyRate}%</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="size-2 rounded-full bg-green-500 ring-2 ring-green-500/20" />
            <span className="text-muted-foreground">Positive Rate</span>
            <span className="font-bold text-base tabular-nums">{positiveRate}%</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="size-2 rounded-full bg-violet-500 ring-2 ring-violet-500/20" />
            <span className="text-muted-foreground">Meetings Closed</span>
            <span className="font-bold text-base tabular-nums">
              {data.meetingsClosed}
            </span>
          </div>
        </div>
      </div>

      {/* Email Activity */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest">
          Email Activity
        </h3>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {emailStats.map((stat) => (
            <StatCard
              key={stat.title}
              {...stat}
            />
          ))}
        </div>
      </section>

      {/* Meeting Pipeline */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest">
          Meeting Outcomes
        </h3>
        <MeetingFunnel data={data} totalPositiveReplies={data.totalPositiveReplies} />
      </section>
    </div>
  );
}
