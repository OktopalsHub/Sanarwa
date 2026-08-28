import { apiClient } from "../client";

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

  constructor(private sessionId?: string) {}

  /**
   * Connect to WebRTC signaling WebSocket
   */
  connect(userId: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = apiClient.connectWebSocket("/webrtc");
        if (!wsUrl) {
          reject(new Error("WebSocket not supported"));
          return;
        }

        // Create WebSocket connection with authentication
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

  /**
   * Send WebRTC offer
   */
  sendOffer(offer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.sendMessage("offer", offer, targetUserId);
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(answer: RTCSessionDescriptionInit, targetUserId: string): void {
    this.sendMessage("answer", answer, targetUserId);
  }

  /**
   * Send ICE candidate
   */
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

  /**
   * Send call request
   */
  sendCallRequest(targetUserId: string, callData: any): void {
    this.sendMessage("call-request", callData, targetUserId);
  }

  /**
   * Send call response (accept/decline)
   */
  sendCallResponse(targetUserId: string, response: "accept" | "reject", data?: any): void {
    this.sendMessage("call-response", { response, ...data }, targetUserId);
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
      this.eventHandlers.get(type)!.forEach((handler) => {
        try {
          handler(data, message);
        } catch (error) {
          console.error(`Error in ${type} handler:`, error);
        }
      });
    }

    // Handle specific message types
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

  /**
   * Emit event to handlers
   */
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

  /**
   * Handle WebSocket reconnection
   */
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
      // Note: This would need the original connection parameters
      // In a real implementation, you'd store these when connecting
      console.log("Reconnection logic would go here");
    }, delay);
  }
}
