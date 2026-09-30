export { MailgunProvider } from "./mailgun.provider";
export { SendGridProvider } from "./sendgrid.provider";
export { SESProvider } from "./ses.provider";
export { ResendProvider } from "./resend.provider";

export const EMAIL_PROVIDERS = ["mailgun", "sendgrid", "ses", "resend"] as const;

export type EmailProviderType = (typeof EMAIL_PROVIDERS)[number];

export const EMAIL_FALLBACK_PROVIDER = "ses";
