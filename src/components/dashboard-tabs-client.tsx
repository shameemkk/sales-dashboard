"use client";

import dynamic from "next/dynamic";

const DashboardTabs = dynamic(
  () => import("@/components/dashboard-tabs").then((m) => m.DashboardTabs),
  { ssr: false }
);

export function DashboardTabsClient() {
  return <DashboardTabs />;
}
