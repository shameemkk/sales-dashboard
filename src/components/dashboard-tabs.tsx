"use client";

import { useState } from "react";
import { subDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardClient } from "@/components/dashboard-client";
import { TableClient } from "@/components/table-client";
import { AccountOverview } from "@/components/account-overview";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { logoutAction } from "@/app/actions";
import { TrendingUp, TableIcon, Users, LogOut } from "lucide-react";
import Image from "next/image";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardTabs() {
  const today = new Date();

  // Daily Performance dates — default to yesterday
  const yesterday = subDays(today, 1);
  const [dpStart, setDpStart] = useState<Date>(yesterday);
  const [dpEnd, setDpEnd] = useState<Date>(yesterday);

  // Performance Table dates
  const [tableStart, setTableStart] = useState<Date>(subDays(today, 6));
  const [tableEnd, setTableEnd] = useState<Date>(today);

  return (
    <Tabs
      defaultValue="daily-performance"
      className="flex min-h-screen w-full flex-col"
    >
      {/* Unified header: brand + tabs + theme toggle */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/80 backdrop-blur-lg supports-backdrop-filter:bg-background/60 px-6 md:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-white dark:bg-black overflow-hidden shadow-sm">
            <Image src="/logo.jpg" alt="Logo" width={36} height={36} className="object-contain dark:invert" />
          </div>
          <div className="hidden sm:block">
            <p className="font-bold text-base leading-tight">Uparrowagency Sales</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {getGreeting()}
            </p>
          </div>
        </div>

        {/* Center tabs */}
        <TabsList className="h-9 bg-muted/60 rounded-lg p-1">
          <TabsTrigger
            value="performance-table"
            className="gap-1.5 rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <TableIcon className="size-3.5" />
            <span className="hidden sm:inline">Performance Table</span>
            <span className="sm:hidden">Table</span>
          </TabsTrigger>
          <TabsTrigger
            value="daily-performance"
            className="gap-1.5 rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <TrendingUp className="size-3.5" />
            <span className="hidden sm:inline">Daily Performance</span>
            <span className="sm:hidden">Performance</span>
          </TabsTrigger>
          <TabsTrigger
            value="account-overview"
            className="gap-1.5 rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="size-3.5" />
            <span className="hidden sm:inline">Account Overview</span>
            <span className="sm:hidden">Accounts</span>
          </TabsTrigger>
        </TabsList>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <form action={logoutAction}>
                <Button variant="ghost" size="icon" className="size-9" type="submit">
                  <LogOut className="size-4" />
                  <span className="sr-only">Sign out</span>
                </Button>
              </form>
            </TooltipTrigger>
            <TooltipContent side="bottom">Sign out</TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <TabsContent
        value="performance-table"
        className="mt-0 flex-1 outline-none"
      >
        <main className="mx-auto w-full max-w-7xl px-6 py-6 md:px-8">
          <TableClient
            startDate={tableStart}
            endDate={tableEnd}
            onStartDateChange={setTableStart}
            onEndDateChange={setTableEnd}
          />
        </main>
      </TabsContent>
      <TabsContent
        value="daily-performance"
        className="mt-0 flex-1 outline-none"
      >
        <main className="mx-auto w-full max-w-7xl px-6 py-6 md:px-8">
          <DashboardClient
            startDate={dpStart}
            endDate={dpEnd}
            onStartDateChange={setDpStart}
            onEndDateChange={setDpEnd}
          />
        </main>
      </TabsContent>
      <TabsContent
        value="account-overview"
        className="mt-0 flex-1 outline-none"
      >
        <main className="mx-auto w-full max-w-7xl px-6 py-6 md:px-8">
          <AccountOverview />
        </main>
      </TabsContent>
    </Tabs>
  );
}
