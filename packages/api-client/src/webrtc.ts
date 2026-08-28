export { WebRTCApiClient } from "./webrtc/webrtc-api";
export { WebRTCSignalingManager } from "./webrtc/webrtc-signaling";

import { WebRTCApiClient } from "./webrtc/webrtc-api";
import { WebRTCSignalingManager } from "./webrtc/webrtc-signaling";

export const webrtcApi = new WebRTCApiClient();
export const webrtcSignaling = new WebRTCSignalingManager();
