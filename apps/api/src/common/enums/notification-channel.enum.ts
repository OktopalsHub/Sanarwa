/**
 * Shared notification channel enum used across the application
 * Defines all supported notification channels for the platform
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WHATSAPP = 'whatsapp',
  IN_APP = 'in_app',
  VOICE = 'voice',
  WEBHOOK = 'webhook',
  CHAT = 'chat',
}

/**
 * Core notification channels supported by the platform
 */
export const CoreNotificationChannels = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
  NotificationChannel.IN_APP,
  NotificationChannel.VOICE,
] as const;

/**
 * All supported notification channels
 */
export const AllNotificationChannels = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
  NotificationChannel.IN_APP,
  NotificationChannel.VOICE,
  NotificationChannel.WEBHOOK,
  NotificationChannel.CHAT,
] as const;
