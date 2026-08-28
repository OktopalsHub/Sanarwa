import { Injectable } from "@nestjs/common";
import { BaseEmailProvider, EmailMessage } from "./providers/email/email-provider.interface";
import { IChatProvider, ChatPayload } from "./providers/chat/chat-provider.interface";
import { IPushProvider, PushPayload } from "./providers/push/push-provider.interface";
import { ISMSProvider, SMSPayload, BulkSMSPayload } from "./providers/sms/sms-provider.interface";
import { InAppPayload } from "./providers/in-app/in-app-provider.interface";
import { InAppOrchestratorService } from "./providers/in-app/in-app-orchestrator.service";
import { SMSRoutingService } from "./providers/sms/sms-routing.service";
import { ProviderOrchestratorDeliveryService } from "./provider-orchestrator-delivery.service";
import { ProviderOrchestratorRegistry } from "./provider-orchestrator.registry";

@Injectable()
export class ProviderOrchestratorService {
  constructor(
    private readonly registry: ProviderOrchestratorRegistry,
    private readonly delivery: ProviderOrchestratorDeliveryService,
    private readonly smsRoutingService: SMSRoutingService,
    private readonly inAppOrchestrator: InAppOrchestratorService,
  ) {}

  registerEmailProvider(name: string, provider: BaseEmailProvider): void {
    this.registry.registerEmailProvider(name, provider);
  }

  registerChatProvider(name: string, provider: IChatProvider): void {
    this.registry.registerChatProvider(name, provider);
  }

  registerPushProvider(name: string, provider: IPushProvider): void {
    this.registry.registerPushProvider(name, provider);
  }

  registerSMSProvider(name: string, provider: ISMSProvider): void {
    this.registry.registerSMSProvider(name, provider);
    this.smsRoutingService.registerProvider(provider);
  }

  sendEmail(payload: EmailMessage, tenantId?: string, brandId?: string): Promise<any> {
    return this.delivery.sendEmail(payload, tenantId, brandId);
  }

  sendChatMessage(payload: ChatPayload, providerName: string, tenantId?: string): Promise<any> {
    return this.delivery.sendChatMessage(payload, providerName, tenantId);
  }

  sendPushNotification(payload: PushPayload, tenantId?: string, brandId?: string): Promise<any> {
    return this.delivery.sendPushNotification(payload, tenantId, brandId);
  }

  sendSMS(payload: SMSPayload, tenantId?: string): Promise<any> {
    return this.delivery.sendSMS(payload, tenantId);
  }

  sendBulkSMS(payload: BulkSMSPayload, tenantId?: string): Promise<any> {
    return this.delivery.sendBulkSMS(payload, tenantId);
  }

  sendVoiceCall(
    payload: { to: string[]; message?: string; templateId?: string; templateData?: any },
    tenantId?: string,
  ): Promise<any> {
    return this.delivery.sendVoiceCall(payload, tenantId);
  }

  sendInAppNotification(payload: InAppPayload, tenantId?: string): Promise<any> {
    return this.delivery.sendInAppNotification(payload, tenantId);
  }

  sendToRoom(roomId: string, payload: InAppPayload): Promise<any> {
    return this.delivery.sendToRoom(roomId, payload);
  }

  sendCallNotification(
    payload: InAppPayload & { callData: NonNullable<InAppPayload["callData"]> },
  ): Promise<any> {
    return this.delivery.sendCallNotification(payload);
  }

  getAvailableProviders(type: "email" | "chat" | "push" | "sms" | "voice"): string[] {
    switch (type) {
      case "email":
        return Array.from(this.registry.emailProviders.keys());
      case "chat":
        return Array.from(this.registry.chatProviders.keys());
      case "push":
        return Array.from(this.registry.pushProviders.keys());
      case "sms":
        return Array.from(this.registry.smsProviders.keys());
      case "voice":
        return ["telnyx"];
      default:
        return [];
    }
  }

  getInAppProviderStatus() {
    return this.inAppOrchestrator.getProviderStatus();
  }

  validatePhoneNumber(phoneNumber: string) {
    return this.smsRoutingService.validatePhoneNumber(phoneNumber);
  }
}
