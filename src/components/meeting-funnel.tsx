"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  CalendarCheck,
  CalendarCheck2,
  BadgeCheck,
  CalendarX,
  UserX,
  CalendarOff,
  CalendarArrowUp,
} from "lucide-react";
import type { DailyPerformance } from "@/lib/data";

interface MeetingFunnelProps {
  data: DailyPerformance;
  totalPositiveReplies: number;
}

export function MeetingFunnel({ data, totalPositiveReplies }: MeetingFunnelProps) {
  const overallRate =
    data.meetingsBooked > 0
      ? ((data.meetingsClosed / data.meetingsBooked) * 100).toFixed(0)
      : "0";

  const maxVal = Math.max(data.meetingsBooked, 1);

  const bookedRate = totalPositiveReplies > 0
    ? ((data.meetingsBooked / totalPositiveReplies) * 100).toFixed(1)
    : "0.0";
  const showUpRate = data.meetingsBooked > 0
    ? ((data.meetingsShowUp / data.meetingsBooked) * 100).toFixed(1)
    : "0.0";
  const closedRate = data.meetingsShowUp > 0
    ? ((data.meetingsClosed / data.meetingsShowUp) * 100).toFixed(1)
    : "0.0";
  const noShowRate = data.meetingsBooked > 0
    ? ((data.meetingsNoShow / data.meetingsBooked) * 100).toFixed(1)
    : "0.0";

  const stages = [
    {
      label: "Booked",
      value: data.meetingsBooked,
      rate: bookedRate,
      rateLabel: "of positives",
      icon: CalendarCheck,
      color: "bg-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Showed Up",
      value: data.meetingsShowUp,
      rate: showUpRate,
      rateLabel: "show up %",
      icon: CalendarCheck2,
      color: "bg-emerald-500",
      textColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Closed",
      value: data.meetingsClosed,
      rate: closedRate,
      rateLabel: "close %",
      icon: BadgeCheck,
      color: "bg-violet-500",
      textColor: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-500/10",
    },
  ];

  const dropoffs = [
    {
      label: "No-Show",
      value: data.meetingsNoShow,
      rate: noShowRate,
      icon: CalendarX,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      label: "Disqualified",
      value: data.meetingsDisqualified,
      icon: UserX,
      iconColor: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      label: "Canceled",
      value: data.meetingsCanceled,
      icon: CalendarOff,
      iconColor: "text-slate-500",
      bgColor: "bg-slate-500/10",
    },
    {
      label: "Rescheduled",
      value: data.meetingsRescheduled,
      icon: CalendarArrowUp,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Pipeline funnel card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Meeting Pipeline</CardTitle>
            <span className="text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2.5 py-1 rounded-full">
              {overallRate}% overall conversion
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 items-center gap-4">
            {stages.map((stage) => (
              <div key={stage.label} className="text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5">
                  <div className={`${stage.bgColor} rounded-md p-1`}>
                    <stage.icon className={`size-3.5 ${stage.textColor}`} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                </div>
                <div className="text-3xl font-bold tabular-nums">
                  <AnimatedCounter value={stage.value} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  <span className={`font-semibold ${stage.textColor}`}>{stage.rate}%</span>
                  <span> {stage.rateLabel}</span>
                </div>
                <div className="mx-auto max-w-[120px] h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stage.color} transition-all duration-700 ease-out`}
                    style={{ width: `${(stage.value / maxVal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drop-off cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {dropoffs.map((d) => (
          <Card key={d.label} className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {d.label}
              </CardTitle>
              <div className={`${d.bgColor} rounded-lg p-2 transition-transform duration-200 group-hover:scale-110`}>
                <d.icon className={`h-4 w-4 ${d.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                <AnimatedCounter value={d.value} />
              </div>
              {"rate" in d && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{d.rate}%</span>
                  <span> of booked</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
