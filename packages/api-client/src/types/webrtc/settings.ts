export interface CallSettings {
  id: string;
  userId: string;
  tenantId: string;

  // Audio settings
  audioSettings: {
    defaultInputDevice?: string;
    defaultOutputDevice?: string;
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
    volume: number; // 0-100
  };

  // Video settings
  videoSettings: {
    defaultCamera?: string;
    resolution: "low" | "medium" | "high" | "hd" | "4k";
    frameRate: number;
    enableHdVideo: boolean;
    enableLowLightEnhancement: boolean;
  };

  // Call preferences
  callPreferences: {
    autoAnswer: boolean;
    callWaiting: boolean;
    doNotDisturb: boolean;
    recordCalls: boolean;
    enableTranscription: boolean;
    allowIncomingCalls: boolean;
  };

  // Network settings
  networkSettings: {
    preferredCodecs: {
      audio: string[];
      video: string[];
    };
    bandwidthLimit?: {
      upload: number; // in kbps
      download: number; // in kbps
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
