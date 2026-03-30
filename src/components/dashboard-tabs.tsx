"use client";

import { useState } from "react";
import { subDays } from "date-fns";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardClient } from "@/components/dashboard-client";
import { TableClient } from "@/components/table-client";
import { AccountOverview } from "@/components/account-overview";
import { LeadsTable } from "@/components/leads-table";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { logoutAction } from "@/app/actions";
import { TrendingUp, TableIcon, Users, LogOut, Settings, Contact } from "lucide-react";
import Image from "next/image";
import { getDefaultTableDays } from "@/lib/settings";

type Section = "performance-table" | "daily-performance" | "account-overview" | "leads" | "settings";

const navItems: {
  id: Section;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "daily-performance", label: "Daily Performance", icon: TrendingUp },
  { id: "performance-table", label: "Performance Table", icon: TableIcon },
  { id: "account-overview", label: "Account Overview", icon: Users },
  { id: "leads", label: "Leads", icon: Contact },
  { id: "settings", label: "Settings", icon: Settings },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardTabs() {
  const today = new Date();
  const yesterday = subDays(today, 1);

  const [active, setActive] = useState<Section>("daily-performance");
  const [dpStart, setDpStart] = useState<Date>(yesterday);
  const [dpEnd, setDpEnd] = useState<Date>(yesterday);
  const [tableStart, setTableStart] = useState<Date>(
    () => subDays(today, getDefaultTableDays() - 1)
  );
  const [tableEnd, setTableEnd] = useState<Date>(today);

  const activeLabel = navItems.find((n) => n.id === active)?.label ?? "";

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <div className="cursor-default">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white dark:bg-black overflow-hidden shadow-sm">
                    <Image
                      src="/logo.jpg"
                      alt="Logo"
                      width={32}
                      height={32}
                      className="object-contain dark:invert"
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      Uparrowagency
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {getGreeting()}
                    </span>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      size="lg"
                      isActive={active === item.id}
                      onClick={() => setActive(item.id)}
                      tooltip={item.label}
                      className="py-3 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon className="size-5 shrink-0" />
                      <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="overflow-hidden">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur-lg px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <p className="flex-1 font-semibold text-sm">Uparrowagency Sales Dashboard</p>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <form action={logoutAction}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    type="submit"
                  >
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

        {/* Performance Table — full width, small padding */}
        {active === "performance-table" && (
          <TableClient
            startDate={tableStart}
            endDate={tableEnd}
            onStartDateChange={setTableStart}
            onEndDateChange={setTableEnd}
          />
        )}

        {/* Daily Performance */}
        {active === "daily-performance" && (
          <main className="mx-auto w-full max-w-7xl px-6 py-6 md:px-8">
            <DashboardClient
              startDate={dpStart}
              endDate={dpEnd}
              onStartDateChange={setDpStart}
              onEndDateChange={setDpEnd}
            />
          </main>
        )}

        {/* Account Overview */}
        {active === "account-overview" && (
          <main className="mx-auto w-full max-w-7xl px-6 py-6 md:px-8">
            <AccountOverview />
          </main>
        )}

        {/* Leads */}
        {active === "leads" && (
          <main className="mx-auto w-full max-w-7xl px-6 py-6 md:px-8">
            <LeadsTable />
          </main>
        )}

        {/* Settings */}
        {active === "settings" && <SettingsPanel />}
      </SidebarInset>
    </>
  );
}
