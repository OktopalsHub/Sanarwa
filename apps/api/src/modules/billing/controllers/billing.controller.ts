import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentTenantId } from 'src/common/decorators';
import { TenantContextGuard } from 'src/common/guards';
import { Public } from '../../auth/decorators/public.decorator';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TokenManagementService } from '../../token-management/services/token-management.service';
import {
  AutoTopupConfigDto,
  PurchaseTokenPackDto,
  SubscriptionBillingService,
} from '../services/subscription-billing.service';
import { PaymentMethodService } from '../services/payment-method.service';
import { BillingCurrency } from '../constants/token-packages';
import {
  BYO_ELIGIBLE_CHANNELS,
  BYO_EVENT_TOKEN_COST,
  MANAGED_CHANNEL_TOKEN_COST,
  MANAGED_ONLY_CHANNELS,
  WELCOME_SIGNUP_TOKENS,
} from '../constants/token-pricing';
import { getTokenPackagesResponse } from '../constants/token-packages';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@ApiTags('Billing')
@Controller('billing')
@UseGuards(AuthGuard, TenantContextGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    private billingService: SubscriptionBillingService,
    private tokenManagementService: TokenManagementService,
    private paymentMethodService: PaymentMethodService,
  ) {}

  @Post('tokens/purchase')
  @ApiOperation({ summary: 'Purchase tokens' })
  @ApiResponse({ status: 201, description: 'Token purchase initiated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async purchaseTokens(
    @CurrentTenantId() tenantId: string,
    @Body() dto: PurchaseTokenPackDto,
  ) {
    dto.tenantId = tenantId;
    return this.billingService.purchaseTokens(dto);
  }

  @Get('tokens/purchase/:purchaseId')
  @ApiOperation({ summary: 'Get token purchase status' })
  async getPurchaseStatus(
    @CurrentTenantId() tenantId: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.billingService.getPurchaseStatus(purchaseId, tenantId);
  }

  @Post('tokens/purchase/:purchaseId/sync')
  @ApiOperation({ summary: 'Sync token purchase with payment provider' })
  async syncPurchase(
    @CurrentTenantId() tenantId: string,
    @Param('purchaseId') purchaseId: string,
  ) {
    return this.billingService.syncPurchase(purchaseId, tenantId);
  }

  @Get('tokens/balance')
  @ApiOperation({ summary: 'Get token balance' })
  @ApiResponse({ status: 200, description: 'Token balance retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTokenBalance(@CurrentTenantId() tenantId: string) {
    return this.tokenManagementService.getBalance(tenantId);
  }

  @Get('tokens/transactions')
  @ApiOperation({ summary: 'Get token transaction history' })
  @ApiResponse({ status: 200, description: 'Transaction history retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTokenTransactions(
    @CurrentTenantId() tenantId: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @Query('type') type?: string,
  ) {
    return this.tokenManagementService.getTransactionHistory(
      tenantId,
      Number(limit),
      Number(offset),
      type as any,
    );
  }

  @Get('tokens/usage-stats')
  @ApiOperation({ summary: 'Get token usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTokenUsageStats(
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }

    return this.tokenManagementService.getTokenUsageStats(
      tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('auto-topup')
  @ApiOperation({ summary: 'Configure auto topup' })
  @ApiResponse({ status: 201, description: 'Auto topup configured successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async configureAutoTopup(
    @CurrentTenantId() tenantId: string,
    @Body() dto: AutoTopupConfigDto,
  ) {
    dto.tenantId = tenantId;
    return this.billingService.configureAutoTopup(dto);
  }

  @Get('auto-topup')
  @ApiOperation({ summary: 'Get auto topup configuration' })
  @ApiResponse({ status: 200, description: 'Auto topup configuration retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAutoTopupConfig(@CurrentTenantId() tenantId: string) {
    return this.billingService.getAutoTopupConfig(tenantId);
  }

  @Post('payment-methods/setup')
  @ApiOperation({ summary: 'Start card setup for auto top-up' })
  async startPaymentMethodSetup(
    @CurrentTenantId() tenantId: string,
    @Body() body: { currency: BillingCurrency },
  ) {
    if (!body.currency) {
      throw new BadRequestException('currency is required');
    }
    return this.paymentMethodService.startPaymentMethodSetup(tenantId, body.currency);
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'List saved payment methods' })
  async listPaymentMethods(@CurrentTenantId() tenantId: string) {
    const methods = await this.paymentMethodService.listPaymentMethods(tenantId);
    return {
      data: methods.map((method) => ({
        id: method.id,
        provider: method.provider,
        currency: method.currency,
        cardBrand: method.cardBrand,
        cardLast4: method.cardLast4,
        cardExpMonth: method.cardExpMonth,
        cardExpYear: method.cardExpYear,
        isDefault: method.isDefault,
        status: method.status,
      })),
    };
  }

  @Delete('payment-methods/:paymentMethodId')
  @ApiOperation({ summary: 'Remove a saved payment method' })
  async revokePaymentMethod(
    @CurrentTenantId() tenantId: string,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    await this.paymentMethodService.revokePaymentMethod(tenantId, paymentMethodId);
    return { message: 'Payment method removed' };
  }

  @Get('checkout/context')
  @Public()
  @ApiOperation({ summary: 'Get checkout currency and provider context' })
  async getCheckoutContext(@Headers() headers: Record<string, string | string[] | undefined>) {
    return this.billingService.getCheckoutContext(headers);
  }

  @Get('token-packages')
  @Public()
  @ApiOperation({ summary: 'Get available pay-as-you-go token packages (USD + NGN shelves)' })
  @ApiResponse({ status: 200, description: 'Token packages retrieved successfully' })
  async getTokenPackages() {
    const catalog = getTokenPackagesResponse();

    return {
      ...catalog,
      welcomeSignupTokens: WELCOME_SIGNUP_TOKENS,
      managedChannelTokenCosts: MANAGED_CHANNEL_TOKEN_COST,
      byoEventTokenCost: BYO_EVENT_TOKEN_COST,
      byoEligibleChannels: BYO_ELIGIBLE_CHANNELS,
      managedOnlyChannels: MANAGED_ONLY_CHANNELS,
      byoListRate: {
        USD: { price: 1, events: 1_250, price10: 10, events10: 12_500 },
        NGN: { price: 1_000, events: 1_250, price10: 10_000, events10: 12_500 },
      },
      managedListRate: {
        USD: { price: 1, tokens: 3_000 },
        NGN: { price: 1_000, tokens: 3_000 },
      },
    };
  }

  @Post('webhooks/bachs')
  @Public()
  @ApiOperation({ summary: 'Handle Bachs webhooks' })
  async handleBachsWebhook(@Req() req: RequestWithRawBody, @Headers() headers: Record<string, string | string[] | undefined>) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }
    return this.billingService.handleBachsWebhook(rawBody, headers);
  }

  @Post('webhooks/polar')
  @Public()
  @ApiOperation({ summary: 'Handle Polar webhooks' })
  async handlePolarWebhook(@Req() req: RequestWithRawBody, @Headers() headers: Record<string, string | string[] | undefined>) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }
    return this.billingService.handlePolarWebhook(rawBody, headers);
  }

  @Post('webhooks/nomba')
  @Public()
  @ApiOperation({ summary: 'Handle Nomba webhooks' })
  async handleNombaWebhook(@Req() req: RequestWithRawBody, @Headers() headers: Record<string, string | string[] | undefined>) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }
    return this.billingService.handleNombaWebhook(rawBody, headers);
  }
}
