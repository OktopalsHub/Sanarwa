export interface RealTimeEvent {
  id: string;
  type: RealTimeEventType;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  data: any;
  timestamp: Date;
}

export enum RealTimeEventType {
  CALL_INVITE = "call_invite",
  CALL_STATUS_CHANGE = "call_status_change",
  PARTICIPANT_UPDATE = "participant_update",
  MEDIA_UPDATE = "media_update",
  QUALITY_UPDATE = "quality_update",
  CONNECTION_UPDATE = "connection_update",
  NOTIFICATION = "notification",
  PRESENCE_UPDATE = "presence_update",
  SYSTEM_MESSAGE = "system_message",
}

export interface PresenceInfo {
  userId: string;
  status: "online" | "offline" | "away" | "busy" | "do_not_disturb";
  lastSeen?: Date;
  currentActivity?: string;
  deviceInfo?: {
    type: "desktop" | "mobile" | "tablet" | "web";
    platform: string;
    userAgent?: string;
  };
}
