export { WebSocketProvider } from './websocket.provider';
export { SSEProvider } from './sse.provider';

export const IN_APP_PROVIDERS = [
  'websocket',
  'sse',
] as const;

export type InAppProviderType = typeof IN_APP_PROVIDERS[number];

export const IN_APP_FALLBACK_PROVIDER = 'sse';