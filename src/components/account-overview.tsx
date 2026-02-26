"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emailAccounts } from "@/lib/data";
import { EmailAccountsTable } from "@/components/email-accounts-table";
import { AnimatedCounter } from "@/components/animated-counter";
import { Users, Mail, MessageSquare, Flame } from "lucide-react";

export function AccountOverview() {
  const accounts = emailAccounts;

  const totals = accounts.reduce(
    (acc, account) => ({
      emailsSent: acc.emailsSent + account.totalEmailsSent,
      replies: acc.replies + account.totalReplies,
      warmupsSent: acc.warmupsSent + account.totalWarmupsSent,
    }),
    { emailsSent: 0, replies: 0, warmupsSent: 0 }
  );

  const overallReplyRate =
    totals.emailsSent > 0
      ? ((totals.replies / totals.emailsSent) * 100).toFixed(1)
      : "0.0";

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const warmingCount = accounts.filter((a) => a.status === "warming").length;

  const summaryCards = [
    {
      title: "Total Accounts",
      value: accounts.length,
      sub: `${activeCount} active`,
      icon: Users,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      bar: { current: activeCount, max: accounts.length, color: "bg-blue-500" },
    },
    {
      title: "Total Emails Sent",
      value: totals.emailsSent,
      sub: "Across all accounts",
      icon: Mail,
      iconColor: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
    {
      title: "Overall Reply Rate",
      value: null,
      displayValue: `${overallReplyRate}%`,
      sub: `${totals.replies.toLocaleString()} total replies`,
      icon: MessageSquare,
      iconColor: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      bar: {
        current: totals.replies,
        max: totals.emailsSent,
        color: "bg-emerald-500",
      },
    },
    {
      title: "Total Warmups Sent",
      value: totals.warmupsSent,
      sub: `${warmingCount} accounts warming`,
      icon: Flame,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
      bar: { current: warmingCount, max: accounts.length, color: "bg-amber-500" },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Account Overview
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          All email accounts and their performance metrics
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </CardTitle>
              <div
                className={`${card.bgColor} rounded-lg p-2 transition-transform duration-200 group-hover:scale-110`}
              >
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {card.value !== null ? (
                  <AnimatedCounter value={card.value} />
                ) : (
                  card.displayValue
                )}
              </div>
              {card.bar && (
                <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${card.bar.color} transition-all duration-700 ease-out`}
                    style={{
                      width: `${
                        card.bar.max > 0
                          ? (card.bar.current / card.bar.max) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                {card.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmailAccountsTable accounts={accounts} />
    </div>
  );
}
