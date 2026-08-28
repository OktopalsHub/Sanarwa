import type {
  AcceptCallRequest,
  CallHistoryQueryParams,
  CallRecord,
  CallSession,
  CallSettings,
  DeclineCallRequest,
  EndCallRequest,
  InitiateCallRequest,
  SendSignalingMessageRequest,
  UpdateCallSettingsRequest,
  UpdateMediaSettingsRequest,
} from "../types/webrtc";
import { apiClient } from "../client";

/**
 * WebRTC API Client
 * Handles all WebRTC-related API calls including call management, signaling, and settings
 */
export class WebRTCApiClient {
  /**
   * Initiate a new WebRTC call
   */
  async initiateCall(data: InitiateCallRequest): Promise<CallSession> {
    const payload = {
      calleeId: data.calleeId,
      callType: data.type || "manual_call",
      templateId: data.metadata?.templateId,
      templateData: data.metadata?.templateData,
      metadata: data.metadata,
    };

    return apiClient.post<CallSession>("/webrtc/call/initiate", payload);
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(data: AcceptCallRequest): Promise<CallSession> {
    return apiClient.post<CallSession>(`/webrtc/call/${data.sessionId}/accept`, {
      mediaSettings: data.mediaSettings,
    });
  }

  /**
   * Decline an incoming call
   */
  async declineCall(data: DeclineCallRequest): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${data.sessionId}/decline`, {
      reason: data.reason,
    });
  }

  /**
   * End an active call
   */
  async endCall(data: EndCallRequest): Promise<CallSession> {
    return apiClient.post<CallSession>(`/webrtc/call/${data.sessionId}/end`, {
      reason: data.reason,
    });
  }

  /**
   * Get call session details
   */
  async getCallSession(sessionId: string): Promise<CallSession> {
    return apiClient.get<CallSession>(`/webrtc/call/${sessionId}`);
  }

  /**
   * Get call history with optional filtering
   */
  async getCallHistory(params?: CallHistoryQueryParams): Promise<{
    calls: CallRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryParams = {
      page: params?.page || 1,
      limit: params?.limit || 20,
      userId: params?.userId,
      type: params?.type,
      status: params?.status,
      startDate: params?.startDate?.toISOString(),
      endDate: params?.endDate?.toISOString(),
      sortBy: params?.sortBy,
      sortOrder: params?.sortOrder,
    };

    // Remove undefined values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key as keyof typeof queryParams] === undefined) {
        delete queryParams[key as keyof typeof queryParams];
      }
    });

    return apiClient.get<{
      calls: CallRecord[];
      total: number;
      page: number;
      limit: number;
    }>("/webrtc/calls", queryParams);
  }

  /**
   * Update media settings for a call participant
   */
  async updateMediaSettings(data: UpdateMediaSettingsRequest): Promise<void> {
    return apiClient.patch<void>(
      `/webrtc/call/${data.sessionId}/participant/${data.participantId}/media`,
      { mediaSettings: data.mediaSettings },
    );
  }

  /**
   * Send signaling message (offer, answer, ICE candidate)
   */
  async sendSignalingMessage(data: SendSignalingMessageRequest): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${data.sessionId}/signal`, {
      toUserId: data.toUserId,
      type: data.type,
      payload: data.payload,
    });
  }

  /**
   * Get current call settings for the user
   */
  async getCallSettings(): Promise<CallSettings> {
    return apiClient.get<CallSettings>("/webrtc/settings");
  }

  /**
   * Update call settings
   */
  async updateCallSettings(data: UpdateCallSettingsRequest): Promise<CallSettings> {
    return apiClient.patch<CallSettings>("/webrtc/settings", data);
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<MediaDeviceInfo[]> {
    return apiClient.get<MediaDeviceInfo[]>("/webrtc/devices");
  }

  /**
   * Test media device functionality
   */
  async testMediaDevice(
    deviceId: string,
    type: "audio" | "video",
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    return apiClient.post<{ success: boolean; error?: string }>("/webrtc/devices/test", {
      deviceId,
      type,
    });
  }

  /**
   * Get call quality metrics for a session
   */
  async getCallQualityMetrics(sessionId: string): Promise<any> {
    return apiClient.get<any>(`/webrtc/call/${sessionId}/quality`);
  }

  /**
   * Report call quality metrics
   */
  async reportCallQualityMetrics(sessionId: string, metrics: any): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${sessionId}/quality`, metrics);
  }

  /**
   * Get active call sessions for the current user
   */
  async getActiveSessions(): Promise<CallSession[]> {
    return apiClient.get<CallSession[]>("/webrtc/sessions/active");
  }

  /**
   * Join an existing call session
   */
  async joinSession(sessionId: string): Promise<CallSession> {
    return apiClient.post<CallSession>(`/webrtc/call/${sessionId}/join`);
  }

  /**
   * Leave a call session
   */
  async leaveSession(sessionId: string): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${sessionId}/leave`);
  }

  /**
   * Mute/unmute audio for a participant
   */
  async toggleAudio(sessionId: string, participantId: string, muted: boolean): Promise<void> {
    return apiClient.patch<void>(`/webrtc/call/${sessionId}/participant/${participantId}/audio`, {
      muted,
    });
  }

  /**
   * Enable/disable video for a participant
   */
  async toggleVideo(sessionId: string, participantId: string, enabled: boolean): Promise<void> {
    return apiClient.patch<void>(`/webrtc/call/${sessionId}/participant/${participantId}/video`, {
      enabled,
    });
  }

  /**
   * Start/stop screen sharing
   */
  async toggleScreenShare(
    sessionId: string,
    participantId: string,
    sharing: boolean,
  ): Promise<void> {
    return apiClient.patch<void>(`/webrtc/call/${sessionId}/participant/${participantId}/screen`, {
      sharing,
    });
  }

  /**
   * Get call logs for debugging
   */
  async getCallLogs(sessionId: string): Promise<any[]> {
    return apiClient.get<any[]>(`/webrtc/call/${sessionId}/logs`);
  }

  /**
   * Create a WebSocket connection for real-time signaling
   */
  createSignalingConnection(sessionId: string): WebSocket | null {
    return apiClient.connectWebSocket(`/webrtc?sessionId=${sessionId}`);
  }
}
