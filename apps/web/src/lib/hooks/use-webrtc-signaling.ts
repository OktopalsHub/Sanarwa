import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CallSession,
  WebRTCSignalingMessage
} from '../types/websocket';
import { useWebSocket, useWebSocketSubscription } from './use-websocket';

interface WebRTCState {
  currentSession: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  connectionState: RTCPeerConnectionState;
  isInitiator: boolean;
  error: string | null;
}

interface UseWebRTCSignalingOptions {
  enabled?: boolean;
  iceServers?: RTCIceServer[];
  mediaConstraints?: MediaStreamConstraints;
}

interface UseWebRTCSignalingReturn extends WebRTCState {
  initiateCall: (targetUserId: string) => Promise<void>;
  acceptCall: (sessionId: string) => Promise<void>;
  rejectCall: (sessionId: string) => void;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
}

/**
 * Hook for managing WebRTC signaling and peer connections
 */
export function useWebRTCSignaling(
  userId: string,
  options: UseWebRTCSignalingOptions = {}
): UseWebRTCSignalingReturn {
  const {
    enabled = true,
    iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    mediaConstraints = { video: true, audio: true }
  } = options;

  const [state, setState] = useState<WebRTCState>({
    currentSession: null,
    localStream: null,
    remoteStream: null,
    isConnected: false,
    connectionState: 'new',
    isInitiator: false,
    error: null
  });

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const { sendMessage } = useWebSocket();

  // Subscribe to WebRTC signaling messages
  const { isConnected: wsConnected } = useWebSocketSubscription(
    'webrtc-signaling',
    useCallback(async (message: WebRTCSignalingMessage) => {
      // Only handle messages intended for this user
      if (message.to !== userId) return;

      try {
        switch (message.type) {
          case 'call-request':
            await handleCallRequest(message);
            break;
          case 'call-accept':
            await handleCallAccept(message);
            break;
          case 'call-reject':
            handleCallReject(message);
            break;
          case 'call-end':
            handleCallEnd(message);
            break;
          case 'offer':
            await handleOffer(message);
            break;
          case 'answer':
            await handleAnswer(message);
            break;
          case 'ice-candidate':
            await handleIceCandidate(message);
            break;
        }
      } catch (error) {
        console.error('Error handling WebRTC signaling message:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    }, [userId]),
    { enabled }
  );

  // Update connection state
  useEffect(() => {
    setState(prev => ({ ...prev, isConnected: wsConnected }));
  }, [wsConnected]);

  // Set up peer connection event handlers
  const setupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = pc;

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      setState(prev => ({ ...prev, connectionState: pc.connectionState }));

      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setState(prev => ({ ...prev, error: 'Connection failed' }));
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setState(prev => ({ ...prev, remoteStream: remoteStream || null }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && state.currentSession) {
        sendMessage('webrtc-signaling', {
          type: 'ice-candidate',
          sessionId: state.currentSession.id,
          from: userId,
          to: state.isInitiator ? state.currentSession.participants[1] : state.currentSession.initiator,
          data: event.candidate,
          timestamp: Date.now()
        });
      }
    };

    return pc;
  }, [iceServers, userId, sendMessage, state.currentSession, state.isInitiator]);

  // Get user media
  const getUserMedia = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      setState(prev => ({ ...prev, localStream: stream }));
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }, [mediaConstraints]);

  // Handle incoming call request
  const handleCallRequest = useCallback(async (message: WebRTCSignalingMessage) => {
    const session: CallSession = {
      id: message.sessionId,
      initiator: message.from,
      participants: [message.from, message.to],
      status: 'ringing',
      startedAt: new Date(),
      metadata: message.data
    };

    setState(prev => ({
      ...prev,
      currentSession: session,
      isInitiator: false,
      error: null
    }));
  }, []);

  // Handle call acceptance
  const handleCallAccept = useCallback(async (message: WebRTCSignalingMessage) => {
    if (!state.currentSession || state.currentSession.id !== message.sessionId) return;

    setState(prev => ({
      ...prev,
      currentSession: prev.currentSession ? {
        ...prev.currentSession,
        status: 'active'
      } : null
    }));

    // Start the WebRTC connection as initiator
    if (state.isInitiator) {
      const pc = setupPeerConnection();
      const stream = await getUserMedia();

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendMessage('webrtc-signaling', {
        type: 'offer',
        sessionId: message.sessionId,
        from: userId,
        to: message.from,
        data: offer,
        timestamp: Date.now()
      });
    }
  }, [state.currentSession, state.isInitiator, setupPeerConnection, getUserMedia, sendMessage, userId]);

  // Handle call rejection
  const handleCallReject = useCallback((message: WebRTCSignalingMessage) => {
    setState(prev => ({
      ...prev,
      currentSession: null,
      isInitiator: false,
      error: 'Call was rejected'
    }));
  }, []);

  // Handle call end
  const handleCallEnd = useCallback((message: WebRTCSignalingMessage) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }

    setState(prev => ({
      ...prev,
      currentSession: null,
      localStream: null,
      remoteStream: null,
      isInitiator: false,
      connectionState: 'closed',
      error: null
    }));
  }, [state.localStream]);

  // Handle WebRTC offer
  const handleOffer = useCallback(async (message: WebRTCSignalingMessage) => {
    if (!state.currentSession || state.currentSession.id !== message.sessionId) return;

    const pc = setupPeerConnection();
    const stream = await getUserMedia();

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    await pc.setRemoteDescription(message.data);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendMessage('webrtc-signaling', {
      type: 'answer',
      sessionId: message.sessionId,
      from: userId,
      to: message.from,
      data: answer,
      timestamp: Date.now()
    });
  }, [state.currentSession, setupPeerConnection, getUserMedia, sendMessage, userId]);

  // Handle WebRTC answer
  const handleAnswer = useCallback(async (message: WebRTCSignalingMessage) => {
    if (!peerConnectionRef.current) return;

    await peerConnectionRef.current.setRemoteDescription(message.data);
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (message: WebRTCSignalingMessage) => {
    if (!peerConnectionRef.current) return;

    await peerConnectionRef.current.addIceCandidate(message.data);
  }, []);

  // Initiate a call
  const initiateCall = useCallback(async (targetUserId: string) => {
    if (!wsConnected) {
      throw new Error('WebSocket not connected');
    }

    const sessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: CallSession = {
      id: sessionId,
      initiator: userId,
      participants: [userId, targetUserId],
      status: 'initiating',
      startedAt: new Date()
    };

    setState(prev => ({
      ...prev,
      currentSession: session,
      isInitiator: true,
      error: null
    }));

    sendMessage('webrtc-signaling', {
      type: 'call-request',
      sessionId,
      from: userId,
      to: targetUserId,
      data: { mediaConstraints },
      timestamp: Date.now()
    });
  }, [wsConnected, userId, sendMessage, mediaConstraints]);

  // Accept an incoming call
  const acceptCall = useCallback(async (sessionId: string) => {
    if (!state.currentSession || state.currentSession.id !== sessionId) {
      throw new Error('No matching call session found');
    }

    sendMessage('webrtc-signaling', {
      type: 'call-accept',
      sessionId,
      from: userId,
      to: state.currentSession.initiator,
      data: {},
      timestamp: Date.now()
    });

    setState(prev => ({
      ...prev,
      currentSession: prev.currentSession ? {
        ...prev.currentSession,
        status: 'active'
      } : null
    }));
  }, [state.currentSession, sendMessage, userId]);

  // Reject an incoming call
  const rejectCall = useCallback((sessionId: string) => {
    if (!state.currentSession || state.currentSession.id !== sessionId) return;

    sendMessage('webrtc-signaling', {
      type: 'call-reject',
      sessionId,
      from: userId,
      to: state.currentSession.initiator,
      data: {},
      timestamp: Date.now()
    });

    setState(prev => ({
      ...prev,
      currentSession: null,
      isInitiator: false
    }));
  }, [state.currentSession, sendMessage, userId]);

  // End the current call
  const endCall = useCallback(() => {
    if (!state.currentSession) return;

    const targetUserId = state.isInitiator
      ? state.currentSession.participants[1]
      : state.currentSession.initiator;

    sendMessage('webrtc-signaling', {
      type: 'call-end',
      sessionId: state.currentSession.id,
      from: userId,
      to: targetUserId,
      data: {},
      timestamp: Date.now()
    });

    // Clean up local resources
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }

    setState(prev => ({
      ...prev,
      currentSession: null,
      localStream: null,
      remoteStream: null,
      isInitiator: false,
      connectionState: 'closed'
    }));
  }, [state.currentSession, state.isInitiator, state.localStream, sendMessage, userId]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [state.localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (state.localStream) {
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [state.localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [state.localStream]);

  return {
    ...state,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled
  };
}

/**
 * Hook for managing call history and settings
 */
export function useCallHistory() {
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addCallToHistory = useCallback((session: CallSession) => {
    setCallHistory(prev => [session, ...prev].slice(0, 100)); // Keep last 100 calls
  }, []);

  const getCallById = useCallback((id: string) => {
    return callHistory.find(call => call.id === id);
  }, [callHistory]);

  const getCallsByParticipant = useCallback((userId: string) => {
    return callHistory.filter(call =>
      call.participants.includes(userId) || call.initiator === userId
    );
  }, [callHistory]);

  const clearHistory = useCallback(() => {
    setCallHistory([]);
  }, []);

  return {
    callHistory,
    isLoading,
    addCallToHistory,
    getCallById,
    getCallsByParticipant,
    clearHistory
  };
}