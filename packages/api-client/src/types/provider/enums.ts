export enum ProviderType {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  WHATSAPP = "whatsapp",
  WEBHOOK = "webhook",
  VOICE = "voice",
}

export enum ProviderStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  TESTING = "testing",
  ERROR = "error",
  MAINTENANCE = "maintenance",
}

export enum ProviderHealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

export enum EmailProviderType {
  AWS_SES = "aws_ses",
  SENDGRID = "sendgrid",
  MAILGUN = "mailgun",
  POSTMARK = "postmark",
  SMTP = "smtp",
}

export enum SmsProviderType {
  TWILIO = "twilio",
  AWS_SNS = "aws_sns",
  TERMII = "termii",
  NEXMO = "nexmo",
  MESSAGEBIRD = "messagebird",
}

export enum PushProviderType {
  FIREBASE = "firebase",
  AWS_PINPOINT = "aws_pinpoint",
  APNS = "apns",
  FCM = "fcm",
  ONESIGNAL = "onesignal",
}

export enum WhatsAppProviderType {
  WHATSAPP_BUSINESS = "whatsapp_business",
  TWILIO_WHATSAPP = "twilio_whatsapp",
  MESSAGEBIRD_WHATSAPP = "messagebird_whatsapp",
}

