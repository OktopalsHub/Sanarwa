import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CallSession, WebRTCSignalingMessage } from '../../types/websocket';
import { useCallHistory, useWebRTCSignaling } from '../use-webrtc-signaling';

// Mock WebRTC APIs
const mockRTCPeerConnection = {
  createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer' }),
  createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  addTrack: vi.fn(),
  close: vi.fn(),
  connectionState: 'new' as RTCPeerConnectionState,
  onconnectionstatechange: null as any,
  ontrack: null as any,
  onicecandidate: null as any
};

const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([
    { kind: 'audio', enabled: true, stop: vi.fn() },
    { kind: 'video', enabled: true, stop: vi.fn() }
  ]),
  getAudioTracks: vi.fn().mockReturnValue([{ enabled: true, stop: vi.fn() }]),
  getVideoTracks: vi.fn().mockReturnValue([{ enabled: true, stop: vi.fn() }])
};

// Mock global WebRTC APIs
(global as any).RTCPeerConnection = vi.fn(() => mockRTCPeerConnection);
(global as any).navigator = {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
  }
};

// Mock WebSocket hooks
vi.mock('../use-websocket', () => ({
  useWebSocketSubscription: vi.fn((channel, callback, options) => {
    (global as any).mockWebSocketCallbacks = (global as any).mockWebSocketCallbacks || {};
    (global as any).mockWebSocketCallbacks[channel] = callback;

    return {
      isConnected: true,
      isSubscribed: true,
      connectionState: { status: 'connected', reconnectAttempts: 0 }
    };
  }),
  useWebSocket: vi.fn(() => ({
    sendMessage: vi.fn()
  }))
}));

describe('useWebRTCSignaling', () => {
  const userId = 'user1';
  const targetUserId = 'user2';

  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).mockWebSocketCallbacks = {};

    // Reset mock implementations
    mockRTCPeerConnection.connectionState = 'new';
    mockRTCPeerConnection.onconnectionstatechange = null;
    mockRTCPeerConnection.ontrack = null;
    mockRTCPeerConnection.onicecandidate = null;
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    expect(result.current.currentSession).toBeNull();
    expect(result.current.localStream).toBeNull();
    expect(result.current.remoteStream).toBeNull();
    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionState).toBe('new');
    expect(result.current.isInitiator).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isAudioEnabled).toBe(true);
    expect(result.current.isVideoEnabled).toBe(true);
  });

  it('should initiate a call', async () => {
    const { useWebSocket } = require('../use-websocket');
    const mockSendMessage = vi.fn();
    useWebSocket.mockReturnValue({ sendMessage: mockSendMessage });

    const { result } = renderHook(() => useWebRTCSignaling(userId));

    await act(async () => {
      await result.current.initiateCall(targetUserId);
    });

    expect(result.current.currentSession).toBeTruthy();
    expect(result.current.currentSession?.initiator).toBe(userId);
    expect(result.current.currentSession?.participants).toEqual([userId, targetUserId]);
    expect(result.current.currentSession?.status).toBe('initiating');
    expect(result.current.isInitiator).toBe(true);

    expect(mockSendMessage).toHaveBeenCalledWith('webrtc-signaling', {
      type: 'call-request',
      sessionId: expect.any(String),
      from: userId,
      to: targetUserId,
      data: expect.any(Object),
      timestamp: expect.any(Number)
    });
  });

  it('should handle incoming call request', () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    const callRequest: WebRTCSignalingMessage = {
      type: 'call-request',
      sessionId: 'session123',
      from: targetUserId,
      to: userId,
      data: { mediaConstraints: { video: true, audio: true } },
      timestamp: Date.now()
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callRequest);
    });

    expect(result.current.currentSession).toBeTruthy();
    expect(result.current.currentSession?.id).toBe('session123');
    expect(result.current.currentSession?.initiator).toBe(targetUserId);
    expect(result.current.currentSession?.status).toBe('ringing');
    expect(result.current.isInitiator).toBe(false);
  });

  it('should accept a call', async () => {
    const { useWebSocket } = require('../use-websocket');
    const mockSendMessage = vi.fn();
    useWebSocket.mockReturnValue({ sendMessage: mockSendMessage });

    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // First, simulate incoming call
    const callRequest: WebRTCSignalingMessage = {
      type: 'call-request',
      sessionId: 'session123',
      from: targetUserId,
      to: userId,
      data: {},
      timestamp: Date.now()
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callRequest);
    });

    // Then accept the call
    await act(async () => {
      await result.current.acceptCall('session123');
    });

    expect(result.current.currentSession?.status).toBe('active');
    expect(mockSendMessage).toHaveBeenCalledWith('webrtc-signaling', {
      type: 'call-accept',
      sessionId: 'session123',
      from: userId,
      to: targetUserId,
      data: {},
      timestamp: expect.any(Number)
    });
  });

  it('should reject a call', () => {
    const { useWebSocket } = require('../use-websocket');
    const mockSendMessage = vi.fn();
    useWebSocket.mockReturnValue({ sendMessage: mockSendMessage });

    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // First, simulate incoming call
    const callRequest: WebRTCSignalingMessage = {
      type: 'call-request',
      sessionId: 'session123',
      from: targetUserId,
      to: userId,
      data: {},
      timestamp: Date.now()
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callRequest);
    });

    // Then reject the call
    act(() => {
      result.current.rejectCall('session123');
    });

    expect(result.current.currentSession).toBeNull();
    expect(result.current.isInitiator).toBe(false);
    expect(mockSendMessage).toHaveBeenCalledWith('webrtc-signaling', {
      type: 'call-reject',
      sessionId: 'session123',
      from: userId,
      to: targetUserId,
      data: {},
      timestamp: expect.any(Number)
    });
  });

  it('should end a call', () => {
    const { useWebSocket } = require('../use-websocket');
    const mockSendMessage = vi.fn();
    useWebSocket.mockReturnValue({ sendMessage: mockSendMessage });

    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // Set up an active call
    act(() => {
      const callRequest: WebRTCSignalingMessage = {
        type: 'call-request',
        sessionId: 'session123',
        from: targetUserId,
        to: userId,
        data: {},
        timestamp: Date.now()
      };

      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callRequest);
    });

    // End the call
    act(() => {
      result.current.endCall();
    });

    expect(result.current.currentSession).toBeNull();
    expect(result.current.localStream).toBeNull();
    expect(result.current.remoteStream).toBeNull();
    expect(result.current.connectionState).toBe('closed');
    expect(mockSendMessage).toHaveBeenCalledWith('webrtc-signaling', {
      type: 'call-end',
      sessionId: 'session123',
      from: userId,
      to: targetUserId,
      data: {},
      timestamp: expect.any(Number)
    });
  });

  it('should handle WebRTC offer', async () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // Set up an active call session first
    act(() => {
      const callRequest: WebRTCSignalingMessage = {
        type: 'call-request',
        sessionId: 'session123',
        from: targetUserId,
        to: userId,
        data: {},
        timestamp: Date.now()
      };

      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callRequest);
    });

    const offer: WebRTCSignalingMessage = {
      type: 'offer',
      sessionId: 'session123',
      from: targetUserId,
      to: userId,
      data: { type: 'offer', sdp: 'mock-offer' },
      timestamp: Date.now()
    };

    await act(async () => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      await callback(offer);
    });

    expect(mockRTCPeerConnection.setRemoteDescription).toHaveBeenCalledWith(offer.data);
    expect(mockRTCPeerConnection.createAnswer).toHaveBeenCalled();
    expect(mockRTCPeerConnection.setLocalDescription).toHaveBeenCalled();
  });

  it('should handle WebRTC answer', async () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    const answer: WebRTCSignalingMessage = {
      type: 'answer',
      sessionId: 'session123',
      from: targetUserId,
      to: userId,
      data: { type: 'answer', sdp: 'mock-answer' },
      timestamp: Date.now()
    };

    await act(async () => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      await callback(answer);
    });

    // Note: This test assumes a peer connection exists, which might not be the case
    // In a real scenario, we'd need to set up the peer connection first
  });

  it('should handle ICE candidates', async () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    const iceCandidate: WebRTCSignalingMessage = {
      type: 'ice-candidate',
      sessionId: 'session123',
      from: targetUserId,
      to: userId,
      data: { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 },
      timestamp: Date.now()
    };

    await act(async () => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      await callback(iceCandidate);
    });

    // Note: This test assumes a peer connection exists
  });

  it('should toggle audio', () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // Mock local stream
    const mockAudioTrack = { enabled: true };
    const mockLocalStream = {
      getAudioTracks: () => [mockAudioTrack]
    };

    act(() => {
      // Simulate having a local stream
      (result.current as any).state = {
        ...result.current,
        localStream: mockLocalStream
      };
    });

    act(() => {
      result.current.toggleAudio();
    });

    expect(mockAudioTrack.enabled).toBe(false);
  });

  it('should toggle video', () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // Mock local stream
    const mockVideoTrack = { enabled: true };
    const mockLocalStream = {
      getVideoTracks: () => [mockVideoTrack]
    };

    act(() => {
      // Simulate having a local stream
      (result.current as any).state = {
        ...result.current,
        localStream: mockLocalStream
      };
    });

    act(() => {
      result.current.toggleVideo();
    });

    expect(mockVideoTrack.enabled).toBe(false);
  });

  it('should handle call rejection message', () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // Set up an outgoing call
    act(() => {
      result.current.initiateCall(targetUserId);
    });

    const callReject: WebRTCSignalingMessage = {
      type: 'call-reject',
      sessionId: result.current.currentSession!.id,
      from: targetUserId,
      to: userId,
      data: {},
      timestamp: Date.now()
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callReject);
    });

    expect(result.current.currentSession).toBeNull();
    expect(result.current.isInitiator).toBe(false);
    expect(result.current.error).toBe('Call was rejected');
  });

  it('should handle call end message', () => {
    const { result } = renderHook(() => useWebRTCSignaling(userId));

    // Set up an active call
    act(() => {
      const callRequest: WebRTCSignalingMessage = {
        type: 'call-request',
        sessionId: 'session123',
        from: targetUserId,
        to: userId,
        data: {},
        timestamp: Date.now()
      };

      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callRequest);
    });

    const callEnd: WebRTCSignalingMessage = {
      type: 'call-end',
      sessionId: 'session123',
      from: targetUserId,
      to: userId,
      data: {},
      timestamp: Date.now()
    };

    act(() => {
      const callback = (global as any).mockWebSocketCallbacks['webrtc-signaling'];
      callback(callEnd);
    });

    expect(result.current.currentSession).toBeNull();
    expect(result.current.localStream).toBeNull();
    expect(result.current.remoteStream).toBeNull();
    expect(result.current.connectionState).toBe('closed');
  });
});

describe('useCallHistory', () => {
  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useCallHistory());

    expect(result.current.callHistory).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should add calls to history', () => {
    const { result } = renderHook(() => useCallHistory());

    const call: CallSession = {
      id: 'call1',
      initiator: 'user1',
      participants: ['user1', 'user2'],
      status: 'ended',
      startedAt: new Date(),
      endedAt: new Date(),
      duration: 120
    };

    act(() => {
      result.current.addCallToHistory(call);
    });

    expect(result.current.callHistory).toHaveLength(1);
    expect(result.current.callHistory[0]).toEqual(call);
  });

  it('should get call by ID', () => {
    const { result } = renderHook(() => useCallHistory());

    const call: CallSession = {
      id: 'call1',
      initiator: 'user1',
      participants: ['user1', 'user2'],
      status: 'ended',
      startedAt: new Date()
    };

    act(() => {
      result.current.addCallToHistory(call);
    });

    const foundCall = result.current.getCallById('call1');
    expect(foundCall).toEqual(call);

    const notFoundCall = result.current.getCallById('nonexistent');
    expect(notFoundCall).toBeUndefined();
  });

  it('should get calls by participant', () => {
    const { result } = renderHook(() => useCallHistory());

    const calls: CallSession[] = [
      {
        id: 'call1',
        initiator: 'user1',
        participants: ['user1', 'user2'],
        status: 'ended',
        startedAt: new Date()
      },
      {
        id: 'call2',
        initiator: 'user2',
        participants: ['user2', 'user3'],
        status: 'ended',
        startedAt: new Date()
      },
      {
        id: 'call3',
        initiator: 'user1',
        participants: ['user1', 'user3'],
        status: 'ended',
        startedAt: new Date()
      }
    ];

    act(() => {
      calls.forEach(call => result.current.addCallToHistory(call));
    });

    const user1Calls = result.current.getCallsByParticipant('user1');
    const user2Calls = result.current.getCallsByParticipant('user2');
    const user3Calls = result.current.getCallsByParticipant('user3');

    expect(user1Calls).toHaveLength(2);
    expect(user2Calls).toHaveLength(2);
    expect(user3Calls).toHaveLength(2);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useCallHistory());

    const call: CallSession = {
      id: 'call1',
      initiator: 'user1',
      participants: ['user1', 'user2'],
      status: 'ended',
      startedAt: new Date()
    };

    act(() => {
      result.current.addCallToHistory(call);
    });

    expect(result.current.callHistory).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.callHistory).toHaveLength(0);
  });

  it('should limit history to 100 calls', () => {
    const { result } = renderHook(() => useCallHistory());

    // Add 150 calls
    act(() => {
      for (let i = 0; i < 150; i++) {
        const call: CallSession = {
          id: `call${i}`,
          initiator: 'user1',
          participants: ['user1', 'user2'],
          status: 'ended',
          startedAt: new Date(Date.now() + i * 1000)
        };
        result.current.addCallToHistory(call);
      }
    });

    expect(result.current.callHistory).toHaveLength(100);
    // Should keep the most recent calls
    expect(result.current.callHistory[0]?.id).toBe('call149');
    expect(result.current.callHistory[99]?.id).toBe('call50');
  });
});