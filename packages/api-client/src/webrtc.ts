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
  UpdateMediaSettingsRequest
} from './types/webrtc';
import { apiClient } from './client';

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
      callType: data.type || 'manual_call',
      templateId: data.metadata?.templateId,
      templateData: data.metadata?.templateData,
      metadata: data.metadata,
    };

    return apiClient.post<CallSession>('/webrtc/call/initiate', payload);
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
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key as keyof typeof queryParams] === undefined) {
        delete queryParams[key as keyof typeof queryParams];
      }
    });

    return apiClient.get<{
      calls: CallRecord[];
      total: number;
      page: number;
      limit: number;
    }>('/webrtc/calls', queryParams);
  }

  /**
   * Update media settings for a call participant
   */
  async updateMediaSettings(data: UpdateMediaSettingsRequest): Promise<void> {
    return apiClient.patch<void>(
      `/webrtc/call/${data.sessionId}/participant/${data.participantId}/media`,
      { mediaSettings: data.mediaSettings }
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
    return apiClient.get<CallSettings>('/webrtc/settings');
  }

  /**
   * Update call settings
   */
  async updateCallSettings(data: UpdateCallSettingsRequest): Promise<CallSettings> {
    return apiClient.patch<CallSettings>('/webrtc/settings', data);
  }

  /**
   * Get available media devices
   */
  async getMediaDevices(): Promise<MediaDeviceInfo[]> {
    return apiClient.get<MediaDeviceInfo[]>('/webrtc/devices');
  }

  /**
   * Test media device functionality
   */
  async testMediaDevice(deviceId: string, type: 'audio' | 'video'): Promise<{
    success: boolean;
    error?: string;
  }> {
    return apiClient.post<{ success: boolean; error?: string }>('/webrtc/devices/test', {
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
    return apiClient.get<CallSession[]>('/webrtc/sessions/active');
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
    return apiClient.patch<void>(
      `/webrtc/call/${sessionId}/participant/${participantId}/audio`,
      { muted }
    );
  }

  /**
   * Enable/disable video for a participant
   */
  async toggleVideo(sessionId: string, participantId: string, enabled: boolean): Promise<void> {
    return apiClient.patch<void>(
      `/webrtc/call/${sessionId}/participant/${participantId}/video`,
      { enabled }
    );
  }

  /**
   * Start/stop screen sharing
   */
  async toggleScreenShare(sessionId: string, participantId: string, sharing: boolean): Promise<void> {
    return apiClient.patch<void>(
      `/webrtc/call/${sessionId}/participant/${participantId}/screen`,
      { sharing }
    );
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

/**
 * WebSocket Manager for WebRTC Signaling
 * Handles real-time communication for WebRTC calls
 */
export class WebRTCSignalingManager {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private sessionId?: string) { }

  /**
   * Connect to WebRTC signaling WebSocket
   */
  connect(userId: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = apiClient.connectWebSocket('/webrtc');
        if (!wsUrl) {
          reject(new Error('WebSocket not supported'));
          return;
        }

        // Create WebSocket connection with authentication
        const wsEndpoint = wsUrl.url.replace('/webrtc', `/webrtc?userId=${userId}&token=${token}`);
        this.ws = new WebSocket(wsEndpoint);

        this.ws.onopen = () => {
          console.log('WebRTC signaling connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebRTC signaling disconnected');
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebRTC signaling error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebRTC signaling
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
  }

  /**
   * Send signaling message
   */
  sendMessage(type: string, data: any, targetUserId?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message = {
      sessionId: this.sessionId,
      type,
      data,
      targetUserId,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send WebRTC offer
   */
  sendOffer(offer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.sendMessage('offer', offer, targetUserId);
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(answer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.sendMessage('answer', answer, targetUserId);
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(candidate: RTCIceCandidate, targetUserId: string): void {
    this.sendMessage('ice-candidate', {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    }, targetUserId);
  }

  /**
   * Send call request
   */
  sendCallRequest(targetUserId: string, callData: any): void {
    this.sendMessage('call-request', callData, targetUserId);
  }

  /**
   * Send call response (accept/decline)
   */
  sendCallResponse(targetUserId: string, response: 'accept' | 'reject', data?: any): void {
    this.sendMessage('call-response', { response, ...data }, targetUserId);
  }

  /**
   * Subscribe to signaling events
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unsubscribe from signaling events
   */
  off(event: string, handler?: Function): void {
    if (!this.eventHandlers.has(event)) return;

    if (handler) {
      const handlers = this.eventHandlers.get(event)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      this.eventHandlers.delete(event);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    const { type, data } = message;

    // Emit event to registered handlers
    if (this.eventHandlers.has(type)) {
      this.eventHandlers.get(type)!.forEach(handler => {
        try {
          handler(data, message);
        } catch (error) {
          console.error(`Error in ${type} handler:`, error);
        }
      });
    }

    // Handle specific message types
    switch (type) {
      case 'webrtc-signal':
        this.emit('signal', data);
        break;
      case 'incoming-call':
        this.emit('incomingCall', data);
        break;
      case 'call-response':
        this.emit('callResponse', data);
        break;
      case 'call-ended':
        this.emit('callEnded', data);
        break;
      case 'webrtc-error':
        this.emit('error', data);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, data: any): void {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event)!.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Handle WebSocket reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached', null);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      // Note: This would need the original connection parameters
      // In a real implementation, you'd store these when connecting
      console.log('Reconnection logic would go here');
    }, delay);
  }
}

// Export singleton instance
export const webrtcApi = new WebRTCApiClient();
export const webrtcSignaling = new WebRTCSignalingManager();