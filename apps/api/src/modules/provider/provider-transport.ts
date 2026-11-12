import { BaseEmailProvider, EmailMessage } from "./providers/email/email-provider.interface";
import { ChatPayload, IChatProvider } from "./providers/chat/chat-provider.interface";
import { IPushProvider, PushPayload } from "./providers/push/push-provider.interface";
import { BulkSMSPayload, ISMSProvider, SMSPayload } from "./providers/sms/sms-provider.interface";
import { InAppPayload } from "./providers/in-app/in-app-provider.interface";
import { InAppOrchestratorService } from "./providers/in-app/in-app-orchestrator.service";
import { OutboundCallRequest, VoiceService } from "./services/voice.service";
import { ProviderSendOutcome, toProviderSendOutcome } from "./provider-send-outcome";

export interface ProviderTransport<TPayload> {
  send(payload: TPayload): Promise<ProviderSendOutcome>;
}

export type VoiceSendRequest = OutboundCallRequest & { tenantId: string };

export type InAppSendRequest = InAppPayload & { tenantId: string };

export interface SmsTransport extends ProviderTransport<SMSPayload> {
  sendBulk(payload: BulkSMSPayload): Promise<ProviderSendOutcome>;
}

export function emailTransport(provider: BaseEmailProvider): ProviderTransport<EmailMessage> {
  return { send: async (payload) => toProviderSendOutcome(await provider.sendEmail(payload)) };
}

export function pushTransport(provider: IPushProvider): ProviderTransport<PushPayload> {
  return {
    send: async (payload) => toProviderSendOutcome(await provider.sendPushNotification(payload)),
  };
}

export function chatTransport(provider: IChatProvider): ProviderTransport<ChatPayload> {
  return { send: async (payload) => toProviderSendOutcome(await provider.sendMessage(payload)) };
}

export function smsTransport(provider: ISMSProvider): SmsTransport {
  return {
    send: async (payload) => toProviderSendOutcome(await provider.sendSMS(payload)),
    sendBulk: async (payload) => toProviderSendOutcome(await provider.sendBulkSMS(payload)),
  };
}

export function voiceTransport(voiceService: VoiceService): ProviderTransport<VoiceSendRequest> {
  return {
    send: async ({ tenantId, ...request }) => {
      const call = await voiceService.createOutboundCall(request, tenantId);
      return call.success
        ? { status: "sent", externalId: call.callControlId }
        : { status: "failed", reason: call.error || "Telnyx voice call failed" };
    },
  };
}

export function inAppTransport(
  inApp: InAppOrchestratorService,
): ProviderTransport<InAppSendRequest> {
  return {
    send: async (payload) => toProviderSendOutcome(await inApp.sendInAppNotification(payload)),
  };
}
