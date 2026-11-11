import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { TenantContextGuard } from "../../common/guards";
import { AuthModule } from "../auth/auth.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { BillingController } from "./controllers/billing.controller";
import { TokenPurchaseService } from "./services/token-purchase.service";
import { CheckoutProviderService } from "./services/checkout-provider.service";
import { AutoTopupService } from "./services/auto-topup.service";
import { BillingWebhooksService } from "./services/billing-webhooks.service";
import { BillingWebhookLedgerService } from "./services/billing-webhook-ledger.service";
import { BillingIntegrationService } from "./services/billing-integration.service";
import { WelcomeTokenListener } from "./services/welcome-token.listener";
import { BachsService } from "./services/bachs.service";
import { PaymentMethodService } from "./services/payment-method.service";
import { TokenManagementService } from "../token-management/services/token-management.service";
import { Subscription } from "./entities/subscription.entity";
import { TokenPurchase } from "./entities/token-purchase.entity";
import { AutoTopupConfig } from "./entities/auto-topup-config.entity";
import { TokenBalance, TokenTransaction } from "./entities/token-balance.entity";
import { WebhookEvent } from "./entities/webhook-event.entity";
import { TenantPaymentMethod } from "./entities/tenant-payment-method.entity";
import { Tenant } from "../tenant/entities/tenant.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      TokenPurchase,
      AutoTopupConfig,
      TokenBalance,
      TokenTransaction,
      WebhookEvent,
      TenantPaymentMethod,
      Tenant,
    ]),
    ConfigModule,
    AuthModule,
    TenantMemberModule,
  ],
  controllers: [BillingController],
  providers: [
    TokenPurchaseService,
    CheckoutProviderService,
    AutoTopupService,
    BillingWebhookLedgerService,
    BillingWebhooksService,
    BachsService,
    PaymentMethodService,
    TokenManagementService,
    BillingIntegrationService,
    WelcomeTokenListener,
    TenantContextGuard,
  ],
  exports: [
    TokenPurchaseService,
    CheckoutProviderService,
    AutoTopupService,
    BillingWebhookLedgerService,
    BillingWebhooksService,
    TokenManagementService,
    BillingIntegrationService,
    BachsService,
    PaymentMethodService,
  ],
})
export class BillingModule {}
