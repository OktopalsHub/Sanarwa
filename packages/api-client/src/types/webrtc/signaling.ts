import { CallType, MediaType } from "./enums";
import { CallQualityMetrics } from "./quality";

export interface SignalingMessage {
  id: string;
  sessionId: string;
  fromUserId: string;
  toUserId: string;
  type: SignalingMessageType;
  payload: any;
  timestamp: Date;
}

export enum SignalingMessageType {
  CALL_INVITE = "call_invite",
  CALL_ACCEPT = "call_accept",
  CALL_DECLINE = "call_decline",
  CALL_CANCEL = "call_cancel",
  CALL_END = "call_end",
  OFFER = "offer",
  ANSWER = "answer",
  ICE_CANDIDATE = "ice_candidate",
  MEDIA_STATE_CHANGE = "media_state_change",
  PARTICIPANT_JOINED = "participant_joined",
  PARTICIPANT_LEFT = "participant_left",
  QUALITY_UPDATE = "quality_update",
  ERROR = "error",
}

export interface CallInvitePayload {
  sessionId: string;
  callType: CallType;
  callerInfo: {
    id: string;
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
}

export interface MediaStateChangePayload {
  participantId: string;
  mediaType: MediaType;
  enabled: boolean;
  muted?: boolean;
}

export interface QualityUpdatePayload {
  participantId: string;
  metrics: CallQualityMetrics;
}
