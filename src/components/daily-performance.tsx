"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDailyPerformanceByDate,
  getDailyPerformanceByDateRange,
} from "@/lib/data";
import { AnimatedCounter } from "@/components/animated-counter";
import { MeetingFunnel } from "@/components/meeting-funnel";
import {
  Mail,
  Users,
  MessageSquare,
  ThumbsUp,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

function TrendBadge({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (previous === 0) return null;
  const diff = current - previous;
  const pct = ((Math.abs(diff) / previous) * 100).toFixed(0);

  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="size-3" />
        0%
      </span>
    );
  }

  const isUp = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        isUp
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-500 dark:text-red-400"
      }`}
    >
      {isUp ? (
        <TrendingUp className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      {isUp ? "+" : "-"}
      {pct}%
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  prevValue?: number;
  icon: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  comparisonLabel?: string;
}

function StatCard({
  title,
  value,
  prevValue,
  icon: Icon,
  iconColor = "text-primary",
  bgColor = "bg-primary/10",
  comparisonLabel = "vs yesterday",
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
        {prevValue !== undefined && (
          <div className="flex items-center gap-1.5 mt-1">
            <TrendBadge current={value} previous={prevValue} />
            <span className="text-[11px] text-muted-foreground">
              {comparisonLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DailyPerformance({
  startDate,
  endDate,
  action,
}: {
  startDate: string;
  endDate: string;
  action?: React.ReactNode;
}) {
  const isRange = startDate !== endDate;
  const data = isRange
    ? getDailyPerformanceByDateRange(startDate, endDate)
    : getDailyPerformanceByDate(startDate);

  const prevStart = new Date(startDate + "T00:00:00");
  const prevEnd = new Date(endDate + "T00:00:00");
  const rangeDays =
    Math.round(
      (prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
  prevStart.setDate(prevStart.getDate() - rangeDays);
  prevEnd.setDate(prevEnd.getDate() - rangeDays);
  const prevStartStr = prevStart.toISOString().split("T")[0];
  const prevEndStr = prevEnd.toISOString().split("T")[0];
  const prev = isRange
    ? getDailyPerformanceByDateRange(prevStartStr, prevEndStr)
    : getDailyPerformanceByDate(prevStartStr);

  const emailStats = [
    {
      title: "Emails Sent",
      value: data.totalEmailsSent,
      prevValue: prev.totalEmailsSent,
      icon: Mail,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "New Leads",
      value: data.totalNewLeadsContacted,
      prevValue: prev.totalNewLeadsContacted,
      icon: Users,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "Replies",
      value: data.totalReplies,
      prevValue: prev.totalReplies,
      icon: MessageSquare,
      iconColor: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Positive Replies",
      value: data.totalPositiveReplies,
      prevValue: prev.totalPositiveReplies,
      icon: ThumbsUp,
      iconColor: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Follow-ups",
      value: data.totalAutoFollowUpSent,
      prevValue: prev.totalAutoFollowUpSent,
      icon: RefreshCw,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  const replyRate =
    data.totalEmailsSent > 0
      ? ((data.totalReplies / data.totalEmailsSent) * 100).toFixed(1)
      : "0.0";
  const positiveRate =
    data.totalReplies > 0
      ? ((data.totalPositiveReplies / data.totalReplies) * 100).toFixed(0)
      : "0";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isRange ? "Performance Summary" : "Daily Performance"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isRange
              ? `${new Date(startDate + "T00:00:00").toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })} – ${new Date(endDate + "T00:00:00").toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })} (${rangeDays} day${rangeDays > 1 ? "s" : ""})`
              : new Date(startDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
          </p>
        </div>
        {action}
      </div>

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
              comparisonLabel={isRange ? "vs prior period" : "vs yesterday"}
            />
          ))}
        </div>
      </section>

      {/* Meeting Pipeline */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest">
          Meeting Outcomes
        </h3>
        <MeetingFunnel data={data} />
      </section>
    </div>
  );
}
