import { Permission } from "@/lib/types/permissions";
import {
  IconBolt,
  IconBriefcase,
  IconChartBar,
  IconCreditCard,
  IconCube,
  IconHome,
  IconInbox,
  IconKey,
  IconLink,
  IconSettings,
  type Icon,
} from "@tabler/icons-react";

export interface NavigationItem {
  name: string;
  segment: string;
  icon: Icon;
  permissions?: Permission[];
}

export const sendingSegments: NavigationItem[] = [
  { name: "Dashboard", segment: "dashboard", icon: IconHome },
  { name: "Messages", segment: "messages", icon: IconInbox },
  { name: "Campaigns", segment: "campaigns", icon: IconBriefcase, permissions: ["campaigns:read"] },
  { name: "Analytics", segment: "analytics", icon: IconChartBar, permissions: ["analytics:read"] },
];

export const setupSegments: NavigationItem[] = [
  { name: "Projects", segment: "projects", icon: IconCube },
  { name: "Providers", segment: "providers", icon: IconBolt },
  { name: "API Keys", segment: "api-keys", icon: IconKey },
  { name: "Webhooks", segment: "webhooks", icon: IconLink },
];

export const workspaceSegments: NavigationItem[] = [
  { name: "Billing", segment: "billing", icon: IconCreditCard },
  { name: "Settings", segment: "settings", icon: IconSettings, permissions: ["settings:read"] },
];

export function buildNav(base: string, items: NavigationItem[]) {
  return items.map((item) => ({ ...item, href: `${base}/${item.segment}` }));
}
