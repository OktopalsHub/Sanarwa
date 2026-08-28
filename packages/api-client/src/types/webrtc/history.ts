import { CallEndReason, CallStatus, CallType } from "./enums";
import { CallSession } from "./core";

export interface CallRecord {
  id: string;
  sessionId: string;
  tenantId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  startedAt: Date;
  connectedAt?: Date;
  endedAt?: Date;
  duration: number; // in seconds
  endReason: CallEndReason;
  qualityScore?: number; // 1-5
  recordingUrl?: string;
  transcriptUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;

  // Relationships
  caller?: any; // Will be typed in auth.ts
  callee?: any; // Will be typed in auth.ts
  session?: CallSession;
}
