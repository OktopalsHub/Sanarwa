import type { CommunicationChannel } from "@/lib/types/campaign";
import {
  IconBell,
  IconBrandWhatsapp,
  IconMail,
  IconMessage,
  IconMessageCircle,
  IconPhone,
  type Icon,
} from "@tabler/icons-react";

export interface ChannelOption {
  id: CommunicationChannel;
  name: string;
  description: string;
  icon: Icon;
  features: string[];
  popular: boolean;
}

export const CHANNELS: ChannelOption[] = [
  {
    id: "email",
    name: "Email",
    description: "Send rich HTML emails with attachments and tracking",
    icon: IconMail,
    features: ["Rich HTML content", "Attachments", "Open/click tracking", "Personalization"],
    popular: true,
  },
  {
    id: "sms",
    name: "SMS",
    description: "Send text messages for immediate delivery",
    icon: IconMessage,
    features: ["Instant delivery", "High open rates", "Global reach", "Character limit: 160"],
    popular: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Send WhatsApp Business messages",
    icon: IconBrandWhatsapp,
    features: ["Template messages", "Session replies", "Media", "Read receipts"],
    popular: true,
  },
  {
    id: "push",
    name: "Push Notifications",
    description: "Send notifications to mobile and web apps",
    icon: IconBell,
    features: ["Real-time delivery", "Rich media", "Action buttons", "Targeting"],
    popular: false,
  },
  {
    id: "in_app",
    name: "In-App Messages",
    description: "Display messages within your application",
    icon: IconMessageCircle,
    features: ["Contextual messaging", "Rich formatting", "Interactive elements", "User targeting"],
    popular: false,
  },
  {
    id: "voice",
    name: "Voice Calls",
    description: "Make automated voice calls with text-to-speech",
    icon: IconPhone,
    features: ["Text-to-speech", "Voice recordings", "Call tracking", "Global numbers"],
    popular: false,
  },
];
