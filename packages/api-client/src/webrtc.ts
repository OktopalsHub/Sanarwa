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
} from "./types/webrtc";
import { apiClient } from "./client";

export class WebRTCApiClient {
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

  async acceptCall(data: AcceptCallRequest): Promise<CallSession> {
    return apiClient.post<CallSession>(`/webrtc/call/${data.sessionId}/accept`, {
      mediaSettings: data.mediaSettings,
    });
  }

  async declineCall(data: DeclineCallRequest): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${data.sessionId}/decline`, {
      reason: data.reason,
    });
  }

  async endCall(data: EndCallRequest): Promise<CallSession> {
    return apiClient.post<CallSession>(`/webrtc/call/${data.sessionId}/end`, {
      reason: data.reason,
    });
  }

  async getCallSession(sessionId: string): Promise<CallSession> {
    return apiClient.get<CallSession>(`/webrtc/call/${sessionId}`);
  }

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

  async updateMediaSettings(data: UpdateMediaSettingsRequest): Promise<void> {
    return apiClient.patch<void>(
      `/webrtc/call/${data.sessionId}/participant/${data.participantId}/media`,
      { mediaSettings: data.mediaSettings },
    );
  }

  async sendSignalingMessage(data: SendSignalingMessageRequest): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${data.sessionId}/signal`, {
      toUserId: data.toUserId,
      type: data.type,
      payload: data.payload,
    });
  }

  async getCallSettings(): Promise<CallSettings> {
    return apiClient.get<CallSettings>("/webrtc/settings");
  }

  async updateCallSettings(data: UpdateCallSettingsRequest): Promise<CallSettings> {
    return apiClient.patch<CallSettings>("/webrtc/settings", data);
  }

  async getMediaDevices(): Promise<MediaDeviceInfo[]> {
    return apiClient.get<MediaDeviceInfo[]>("/webrtc/devices");
  }

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

  async getCallQualityMetrics(sessionId: string): Promise<any> {
    return apiClient.get<any>(`/webrtc/call/${sessionId}/quality`);
  }

  async reportCallQualityMetrics(sessionId: string, metrics: any): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${sessionId}/quality`, metrics);
  }

  async getActiveSessions(): Promise<CallSession[]> {
    return apiClient.get<CallSession[]>("/webrtc/sessions/active");
  }

  async joinSession(sessionId: string): Promise<CallSession> {
    return apiClient.post<CallSession>(`/webrtc/call/${sessionId}/join`);
  }

  async leaveSession(sessionId: string): Promise<void> {
    return apiClient.post<void>(`/webrtc/call/${sessionId}/leave`);
  }

  async toggleAudio(sessionId: string, participantId: string, muted: boolean): Promise<void> {
    return apiClient.patch<void>(`/webrtc/call/${sessionId}/participant/${participantId}/audio`, {
      muted,
    });
  }

  async toggleVideo(sessionId: string, participantId: string, enabled: boolean): Promise<void> {
    return apiClient.patch<void>(`/webrtc/call/${sessionId}/participant/${participantId}/video`, {
      enabled,
    });
  }

  async toggleScreenShare(
    sessionId: string,
    participantId: string,
    sharing: boolean,
  ): Promise<void> {
    return apiClient.patch<void>(`/webrtc/call/${sessionId}/participant/${participantId}/screen`, {
      sharing,
    });
  }

  async getCallLogs(sessionId: string): Promise<any[]> {
    return apiClient.get<any[]>(`/webrtc/call/${sessionId}/logs`);
  }

  createSignalingConnection(sessionId: string): WebSocket | null {
    return apiClient.connectWebSocket(`/webrtc?sessionId=${sessionId}`);
  }
}

export class WebRTCSignalingManager {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private sessionId?: string) {}

  connect(userId: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = apiClient.connectWebSocket("/webrtc");
        if (!wsUrl) {
          reject(new Error("WebSocket not supported"));
          return;
        }

        const wsEndpoint = wsUrl.url.replace("/webrtc", `/webrtc?userId=${userId}&token=${token}`);
        this.ws = new WebSocket(wsEndpoint);

        this.ws.onopen = () => {
          console.log("WebRTC signaling connected");
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        this.ws.onclose = () => {
          console.log("WebRTC signaling disconnected");
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("WebRTC signaling error:", error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
  }

  sendMessage(type: string, data: any, targetUserId?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
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

  sendOffer(offer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.sendMessage("offer", offer, targetUserId);
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.sendMessage("answer", answer, targetUserId);
  }

  sendIceCandidate(candidate: RTCIceCandidate, targetUserId: string): void {
    this.sendMessage(
      "ice-candidate",
      {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      },
      targetUserId,
    );
  }

  sendCallRequest(targetUserId: string, callData: any): void {
    this.sendMessage("call-request", callData, targetUserId);
  }

  sendCallResponse(targetUserId: string, response: "accept" | "reject", data?: any): void {
    this.sendMessage("call-response", { response, ...data }, targetUserId);
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

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

  private handleMessage(message: any): void {
    const { type, data } = message;

    if (this.eventHandlers.has(type)) {
      this.eventHandlers.get(type)!.forEach((handler) => {
        try {
          handler(data, message);
        } catch (error) {
          console.error(`Error in ${type} handler:`, error);
        }
      });
    }

    switch (type) {
      case "webrtc-signal":
        this.emit("signal", data);
        break;
      case "incoming-call":
        this.emit("incomingCall", data);
        break;
      case "call-response":
        this.emit("callResponse", data);
        break;
      case "call-ended":
        this.emit("callEnded", data);
        break;
      case "webrtc-error":
        this.emit("error", data);
        break;
      default:
        console.log("Unknown message type:", type);
    }
  }

  private emit(event: string, data: any): void {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event)!.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.emit("maxReconnectAttemptsReached", null);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      console.log("Reconnection logic would go here");
    }, delay);
  }
}

export const webrtcApi = new WebRTCApiClient();
export const webrtcSignaling = new WebRTCSignalingManager();
