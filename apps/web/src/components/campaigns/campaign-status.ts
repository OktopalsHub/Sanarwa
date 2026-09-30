import type { BadgeProps } from "@/components/ui/badge";
import type { CampaignStatus, CommunicationChannel } from "@/lib/types/campaign";
import {
  IconBrandWhatsapp,
  IconDeviceMobile,
  IconMail,
  IconMessage,
  IconUsers,
  IconVolume,
} from "@tabler/icons-react";

export const CHANNEL_ICONS = {
  email: IconMail,
  sms: IconMessage,
  push: IconDeviceMobile,
  in_app: IconUsers,
  voice: IconVolume,
  whatsapp: IconBrandWhatsapp,
} as const satisfies Record<CommunicationChannel, typeof IconMail>;

export function campaignStatusVariant(status: CampaignStatus): BadgeProps["variant"] {
  if (status === "cancelled") return "destructive";
  if (status === "active") return "default";
  if (status === "scheduled" || status === "completed") return "secondary";
  return "outline";
}

export function canControlCampaign(status: CampaignStatus) {
  return status === "active" || status === "paused" || status === "scheduled";
}

export function formatCampaignDate(date: Date, long = false) {
  return new Intl.DateTimeFormat(
    "en-US",
    long
      ? {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
  ).format(new Date(date));
}
