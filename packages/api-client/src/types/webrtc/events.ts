import { CallStatus, CallType, MediaType } from "./enums";
import { CallQualityMetrics } from "./quality";

export interface CallSessionCreatedEvent {
  sessionId: string;
  tenantId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  timestamp: Date;
}

export interface CallStatusChangedEvent {
  sessionId: string;
  tenantId: string;
  oldStatus: CallStatus;
  newStatus: CallStatus;
  timestamp: Date;
}

export interface ParticipantJoinedEvent {
  sessionId: string;
  participantId: string;
  userId: string;
  timestamp: Date;
}

export interface ParticipantLeftEvent {
  sessionId: string;
  participantId: string;
  userId: string;
  reason?: string;
  timestamp: Date;
}

export interface MediaStateChangedEvent {
  sessionId: string;
  participantId: string;
  mediaType: MediaType;
  enabled: boolean;
  timestamp: Date;
}

export interface CallQualityChangedEvent {
  sessionId: string;
  participantId: string;
  qualityScore: number;
  metrics: CallQualityMetrics;
  timestamp: Date;
}
