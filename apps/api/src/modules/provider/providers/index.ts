// Email providers
export * from './email/providers';
export * from './email/email-provider.interface';
export * from './email/email.module';

// Chat providers
export * from './chat/providers';
export * from './chat/chat-provider.interface';
export * from './chat/chat.module';

// Push providers
export * from './push/providers';
export * from './push/push-provider.interface';
export * from './push/push.module';

// SMS providers
export * from './sms/providers';
export * from './sms/sms-provider.interface';
export * from './sms/sms-routing.service';
export * from './sms/sms.module';

export const ALL_PROVIDER_TYPES = [
  'email',
  'chat',
  'push',
  'sms',
] as const;

export type ProviderType = typeof ALL_PROVIDER_TYPES[number];