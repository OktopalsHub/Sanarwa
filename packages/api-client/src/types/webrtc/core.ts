import {
  CallEndReason,
  CallStatus,
  CallType,
  ConnectionState,
  IceConnectionState,
  MediaType,
  SignalingState,
} from "./enums";
import { CallQualityMetrics } from "./quality";

export interface CallSession {
  id: string;
  tenantId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  startedAt?: Date;
  connectedAt?: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  endReason?: CallEndReason;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  // Call participants
  participants: CallParticipant[];

  // Media streams
  mediaStreams: MediaStream[];

  // Connection details
  connectionDetails?: ConnectionDetails;

  // Quality metrics
  qualityMetrics?: CallQualityMetrics;

  // Relationships
  caller?: any; // Will be typed in auth.ts
  callee?: any; // Will be typed in auth.ts
  tenant?: any; // Will be typed in tenant.ts
}

export interface CallParticipant {
  id: string;
  sessionId: string;
  userId: string;
  role: "caller" | "callee" | "moderator" | "participant";
  status: "invited" | "joining" | "connected" | "disconnected" | "left";
  joinedAt?: Date;
  leftAt?: Date;
  mediaSettings: MediaSettings;
  connectionState: ConnectionState;
  iceConnectionState: IceConnectionState;
  signalingState: SignalingState;
  metadata?: Record<string, any>;

  // User details (populated when needed)
  user?: any; // Will be typed in auth.ts
}

export interface MediaSettings {
  audio: {
    enabled: boolean;
    muted: boolean;
    deviceId?: string;
    constraints?: MediaTrackConstraints;
  };
  video: {
    enabled: boolean;
    muted: boolean;
    deviceId?: string;
    constraints?: MediaTrackConstraints;
  };
  screen: {
    enabled: boolean;
    sharing: boolean;
  };
}

export interface MediaStream {
  id: string;
  sessionId: string;
  participantId: string;
  type: MediaType;
  streamId: string;
  trackIds: string[];
  isActive: boolean;
  settings: MediaStreamSettings;
  createdAt: Date;
}

export interface MediaStreamSettings {
  audio?: {
    codec: string;
    bitrate: number;
    sampleRate: number;
    channels: number;
  };
  video?: {
    codec: string;
    bitrate: number;
    width: number;
    height: number;
    frameRate: number;
  };
}

export interface ConnectionDetails {
  localDescription?: RTCSessionDescriptionInit;
  remoteDescription?: RTCSessionDescriptionInit;
  iceCandidates: IceCandidate[];
  selectedCandidatePair?: CandidatePair;
  dataChannels: DataChannel[];
}

export interface IceCandidate {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
  usernameFragment?: string;
  type: "host" | "srflx" | "prflx" | "relay";
  protocol: "udp" | "tcp";
  address: string;
  port: number;
  priority: number;
  foundation: string;
}

export interface CandidatePair {
  local: IceCandidate;
  remote: IceCandidate;
  state: "waiting" | "in-progress" | "succeeded" | "failed";
  priority: number;
  nominated: boolean;
}

export interface DataChannel {
  id: string;
  label: string;
  protocol: string;
  ordered: boolean;
  maxRetransmits?: number;
  maxPacketLifeTime?: number;
  readyState: "connecting" | "open" | "closing" | "closed";
  bufferedAmount: number;
}
