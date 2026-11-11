export { TwilioProvider } from "./twilio.provider";
export { TermiiProvider } from "./termii.provider";
export { TelnyxProvider } from "./telnyx.provider";
export { AfricasTalkingProvider } from "./africastalking.provider";

const SMS_PROVIDERS = ["twilio", "termii", "infobip", "telnyx", "africastalking"] as const;

export type SMSProviderType = (typeof SMS_PROVIDERS)[number];
