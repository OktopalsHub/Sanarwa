export { TelnyxVoiceProvider } from './telnyx-voice.provider';

export const VOICE_PROVIDERS = [
  'telnyx-voice',
] as const;

export type VoiceProviderType = typeof VOICE_PROVIDERS[number];

export const VOICE_FALLBACK_PROVIDER = 'telnyx-voice';