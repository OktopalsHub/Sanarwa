export { MailgunProvider } from "./mailgun.provider";
export { SendGridProvider } from "./sendgrid.provider";
export { SESProvider } from "./ses.provider";
export { ResendProvider } from "./resend.provider";
export { SMTPProvider } from "./smtp.provider";
export { ZeptoMailProvider } from "./zeptomail.provider";

export const EMAIL_PROVIDERS = [
  "zeptomail",
  "mailgun",
  "sendgrid",
  "ses",
  "resend",
  "smtp",
] as const;

export type EmailProviderType = (typeof EMAIL_PROVIDERS)[number];
