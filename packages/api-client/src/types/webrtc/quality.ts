export interface CallQualityMetrics {
  sessionId: string;
  overallQuality: "excellent" | "good" | "fair" | "poor";
  audioQuality?: AudioQualityMetrics;
  videoQuality?: VideoQualityMetrics;
  networkQuality?: NetworkQualityMetrics;
  systemMetrics?: SystemMetrics;
  timestamp: Date;
}

export interface AudioQualityMetrics {
  jitter: number; // in milliseconds
  packetLoss: number; // percentage
  roundTripTime: number; // in milliseconds
  bitrate: number; // in kbps
  codec: string;
  mos: number; // Mean Opinion Score (1-5)
}

export interface VideoQualityMetrics {
  jitter: number; // in milliseconds
  packetLoss: number; // percentage
  roundTripTime: number; // in milliseconds
  bitrate: number; // in kbps
  frameRate: number; // fps
  resolution: {
    width: number;
    height: number;
  };
  codec: string;
  freezeCount: number;
  pauseCount: number;
}

export interface NetworkQualityMetrics {
  bandwidth: {
    upload: number; // in kbps
    download: number; // in kbps
  };
  latency: number; // in milliseconds
  jitter: number; // in milliseconds
  packetLoss: number; // percentage
  connectionType: "wifi" | "ethernet" | "cellular" | "unknown";
}

export interface SystemMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  batteryLevel?: number; // percentage
  thermalState?: "nominal" | "fair" | "serious" | "critical";
}
