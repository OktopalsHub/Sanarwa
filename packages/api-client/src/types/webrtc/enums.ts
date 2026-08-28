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
