import { Permission } from "@/lib/types/permissions";
import {
  IconBrandSlack,
  IconChartBar,
  IconCreditCard,
  IconCube,
  IconHome,
  IconKey,
  IconLink,
  IconMail,
  IconSend,
  IconSettings,
  IconSpeakerphone,
  type Icon,
} from "@tabler/icons-react";

export interface NavigationItem {
  name: string;
  segment: string;
  icon: Icon;
  permissions?: Permission[];
}

export interface NavigationGroup {
  title?: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    items: [{ name: "Overview", segment: "dashboard", icon: IconHome }],
  },
  {
    title: "Send",
    items: [
      { name: "Messages", segment: "messages", icon: IconSend },
      {
        name: "Campaigns",
        segment: "campaigns",
        icon: IconSpeakerphone,
        permissions: ["campaigns:read"],
      },
      {
        name: "Analytics",
        segment: "analytics",
        icon: IconChartBar,
        permissions: ["analytics:read"],
      },
    ],
  },
  {
    title: "Connect",
    items: [
      { name: "Email, SMS & push", segment: "providers", icon: IconMail },
      { name: "Chat apps", segment: "channels", icon: IconBrandSlack },
    ],
  },
  {
    title: "Developers",
    items: [
      { name: "Projects", segment: "projects", icon: IconCube },
      { name: "API keys", segment: "api-keys", icon: IconKey },
      { name: "Webhooks", segment: "webhooks", icon: IconLink },
    ],
  },
  {
    title: "Account",
    items: [
      { name: "Billing", segment: "billing", icon: IconCreditCard },
      {
        name: "Settings",
        segment: "settings",
        icon: IconSettings,
        permissions: ["settings:read"],
      },
    ],
  },
];

export function buildNav(base: string, items: NavigationItem[]) {
  return items.map((item) => ({ ...item, href: `${base}/${item.segment}` }));
}
