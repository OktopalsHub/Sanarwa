import { Injectable, Logger } from "@nestjs/common";
import { BaseEmailProvider } from "./providers/email/email-provider.interface";
import { IChatProvider } from "./providers/chat/chat-provider.interface";
import { IPushProvider } from "./providers/push/push-provider.interface";
import { ISMSProvider } from "./providers/sms/sms-provider.interface";

@Injectable()
export class ProviderOrchestratorRegistry {
  private readonly logger = new Logger(ProviderOrchestratorRegistry.name);

  readonly emailProviders = new Map<string, BaseEmailProvider>();
  readonly chatProviders = new Map<string, IChatProvider>();
  readonly pushProviders = new Map<string, IPushProvider>();
  readonly smsProviders = new Map<string, ISMSProvider>();

  registerEmailProvider(name: string, provider: BaseEmailProvider): void {
    this.emailProviders.set(name, provider);
    this.logger.log(`Registered email provider: ${name}`);
  }

  registerChatProvider(name: string, provider: IChatProvider): void {
    this.chatProviders.set(name, provider);
    this.logger.log(`Registered chat provider: ${name}`);
  }

  registerPushProvider(name: string, provider: IPushProvider): void {
    this.pushProviders.set(name, provider);
    this.logger.log(`Registered push provider: ${name}`);
  }

  registerSMSProvider(name: string, provider: ISMSProvider): void {
    this.smsProviders.set(name, provider);
    this.logger.log(`Registered SMS provider: ${name}`);
  }
}
