import { ConnectionState } from "./enums";
import { CallSession } from "./core";
import { CallRecord } from "./history";
import { CallSettings } from "./settings";

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
