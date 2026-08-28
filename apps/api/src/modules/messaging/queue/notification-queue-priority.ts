import { MessagePriority as Priority } from "../message.entity";

export function getPriorityValue(priority: Priority): number {
  switch (priority) {
    case Priority.URGENT:
      return 10;
    case Priority.HIGH:
      return 5;
    case Priority.NORMAL:
      return 1;
    case Priority.LOW:
      return -5;
    default:
      return 1;
  }
}

export function getAlertPriority(severity: string): number {
  switch (severity) {
    case "critical":
      return 20;
    case "high":
      return 15;
    case "medium":
      return 5;
    case "low":
      return 1;
    default:
      return 5;
  }
}
