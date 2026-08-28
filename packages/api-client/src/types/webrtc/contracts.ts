import { CallEndReason, CallStatus, CallType, MediaType } from "./enums";
import { CallSession, MediaSettings } from "./core";
import { CallSettings } from "./settings";
import { SignalingMessageType } from "./signaling";

export interface InitiateCallRequest {
  calleeId: string;
  type: CallType;
  metadata?: Record<string, any>;
}

export interface AcceptCallRequest {
  sessionId: string;
  mediaSettings?: Partial<MediaSettings>;
}

export interface DeclineCallRequest {
  sessionId: string;
  reason?: string;
}

export interface EndCallRequest {
  sessionId: string;
  reason?: CallEndReason;
}

export interface UpdateMediaSettingsRequest {
  sessionId: string;
  participantId: string;
  mediaSettings: Partial<MediaSettings>;
}

export interface SendSignalingMessageRequest {
  sessionId: string;
  toUserId: string;
  type: SignalingMessageType;
  payload: any;
}

export interface UpdateCallSettingsRequest {
  audioSettings?: Partial<CallSettings["audioSettings"]>;
  videoSettings?: Partial<CallSettings["videoSettings"]>;
  callPreferences?: Partial<CallSettings["callPreferences"]>;
  networkSettings?: Partial<CallSettings["networkSettings"]>;
}

export interface CallHistoryQueryParams {
  userId?: string;
  type?: CallType;
  status?: CallStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}
