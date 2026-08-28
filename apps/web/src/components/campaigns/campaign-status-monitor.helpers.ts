import { Activity, AlertCircle, CheckCircle, Clock, XCircle } from "@/lib/icons";

export const STATUS_ICONS = {
  draft: Clock,
  scheduled: Clock,
  active: Activity,
  paused: AlertCircle,
  completed: CheckCircle,
  cancelled: XCircle,
} as const;

export const STATUS_COLORS = {
  draft: "text-gray-500",
  scheduled: "text-blue-500",
  active: "text-green-500",
  paused: "text-yellow-500",
  completed: "text-purple-500",
  cancelled: "text-red-500",
} as const;

export function formatCampaignNumber(num: number) {
  return new Intl.NumberFormat().format(num);
}

export function formatCampaignPercentage(num: number) {
  return `${num.toFixed(1)}%`;
}
