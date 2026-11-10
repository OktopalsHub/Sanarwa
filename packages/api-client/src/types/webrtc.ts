export enum CallStatus {
  INITIATING = "initiating",
  RINGING = "ringing",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ON_HOLD = "on_hold",
  ENDED = "ended",
  FAILED = "failed",
  CANCELLED = "cancelled",
  DECLINED = "declined",
  BUSY = "busy",
  NO_ANSWER = "no_answer",
}

export enum CallType {
  AUDIO = "audio",
  VIDEO = "video",
  SCREEN_SHARE = "screen_share",
}

export enum ConnectionState {
  NEW = "new",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  FAILED = "failed",
  CLOSED = "closed",
}

export enum IceConnectionState {
  NEW = "new",
  CHECKING = "checking",
  CONNECTED = "connected",
  COMPLETED = "completed",
  FAILED = "failed",
  DISCONNECTED = "disconnected",
  CLOSED = "closed",
}

export enum SignalingState {
  STABLE = "stable",
  HAVE_LOCAL_OFFER = "have-local-offer",
  HAVE_REMOTE_OFFER = "have-remote-offer",
  HAVE_LOCAL_PRANSWER = "have-local-pranswer",
  HAVE_REMOTE_PRANSWER = "have-remote-pranswer",
  CLOSED = "closed",
}

export enum MediaType {
  AUDIO = "audio",
  VIDEO = "video",
  SCREEN = "screen",
  DATA = "data",
}

export enum CallEndReason {
  USER_HANGUP = "user_hangup",
  REMOTE_HANGUP = "remote_hangup",
  CONNECTION_FAILED = "connection_failed",
  TIMEOUT = "timeout",
  BUSY = "busy",
  DECLINED = "declined",
  NETWORK_ERROR = "network_error",
  SYSTEM_ERROR = "system_error",
}

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
  duration?: number;
  endReason?: CallEndReason;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;

  participants: CallParticipant[];

  mediaStreams: MediaStream[];

  connectionDetails?: ConnectionDetails;

  qualityMetrics?: CallQualityMetrics;

  caller?: any;
  callee?: any;
  tenant?: any;
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

  user?: any;
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

export interface CallQualityMetrics {
  sessionId: string;
  overallQuality: "excellent" | "good" | "fair" | "poor";
  audioQuality?: AudioQualityMetrics;
  videoQuality?: VideoQualityMetrics;
  networkQuality?: NetworkQualityMetrics;
  systemMetrics?: SystemMetrics;
  timestamp: Date;
}

export interface AudioQualityMetrics {
  jitter: number;
  packetLoss: number;
  roundTripTime: number;
  bitrate: number;
  codec: string;
  mos: number;
}

export interface VideoQualityMetrics {
  jitter: number;
  packetLoss: number;
  roundTripTime: number;
  bitrate: number;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
  codec: string;
  freezeCount: number;
  pauseCount: number;
}

export interface NetworkQualityMetrics {
  bandwidth: {
    upload: number;
    download: number;
  };
  latency: number;
  jitter: number;
  packetLoss: number;
  connectionType: "wifi" | "ethernet" | "cellular" | "unknown";
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  batteryLevel?: number;
  thermalState?: "nominal" | "fair" | "serious" | "critical";
}

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
  duration: number;
  endReason: CallEndReason;
  qualityScore?: number;
  recordingUrl?: string;
  transcriptUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;

  caller?: any;
  callee?: any;
  session?: CallSession;
}

export interface CallSettings {
  id: string;
  userId: string;
  tenantId: string;

  audioSettings: {
    defaultInputDevice?: string;
    defaultOutputDevice?: string;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    volume: number;
  };

  videoSettings: {
    defaultCamera?: string;
    resolution: "low" | "medium" | "high" | "hd" | "4k";
    frameRate: number;
    enableHdVideo: boolean;
    enableLowLightEnhancement: boolean;
  };

  callPreferences: {
    autoAnswer: boolean;
    callWaiting: boolean;
    doNotDisturb: boolean;
    recordCalls: boolean;
    enableTranscription: boolean;
    allowIncomingCalls: boolean;
  };

  networkSettings: {
    preferredCodecs: {
      audio: string[];
      video: string[];
    };
    bandwidthLimit?: {
      upload: number;
      download: number;
    };
    enableIceRestart: boolean;
    iceServers: IceServer[];
  };

  updatedAt: Date;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
  credentialType?: "password" | "oauth";
}

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

export interface WebRTCState {
  currentSession?: CallSession;
  activeSessions: CallSession[];
  callHistory: CallRecord[];
  callSettings?: CallSettings;
  deviceList: MediaDeviceInfo[];
  connectionState: ConnectionState;
  mediaPermissions: {
    audio: boolean;
    video: boolean;
    screen: boolean;
  };
  isLoading: boolean;
  error: string | null;
}

export interface WebRTCApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

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
