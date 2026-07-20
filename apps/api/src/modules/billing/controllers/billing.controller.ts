import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantId } from 'src/common/decorators';
import { TenantContextGuard } from 'src/common/guards';
import { Public } from '../../auth/decorators/public.decorator';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TokenManagementService } from '../../token-management/services/token-management.service';
import { PaystackService } from '../services/paystack.service';
import { PolarService } from '../services/polar.service';
import {
  AutoTopupConfigDto,
  CreateSubscriptionDto,
  PurchaseTokensDto,
  SubscriptionBillingService,
} from '../services/subscription-billing.service';
import {
  BYO_ELIGIBLE_CHANNELS,
  BYO_EVENT_TOKEN_COST,
  MANAGED_CHANNEL_TOKEN_COST,
  MANAGED_ONLY_CHANNELS,
  WELCOME_SIGNUP_TOKENS,
} from '../constants/token-pricing';

@ApiTags('Billing')
@Controller('billing')
@UseGuards(AuthGuard, TenantContextGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    private billingService: SubscriptionBillingService,
    private tokenManagementService: TokenManagementService,
    private polarService: PolarService,
    private paystackService: PaystackService,
  ) {}

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSubscription(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    dto.tenantId = tenantId;
    return this.billingService.createSubscription(dto);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get tenant subscriptions' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSubscriptions(@CurrentTenantId() _tenantId: string) {
    return { message: 'Get subscriptions endpoint' };
  }

  @Post('tokens/purchase')
  @ApiOperation({ summary: 'Purchase tokens' })
  @ApiResponse({ status: 201, description: 'Token purchase initiated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async purchaseTokens(
    @CurrentTenantId() tenantId: string,
    @Body() dto: PurchaseTokensDto,
  ) {
    dto.tenantId = tenantId;
    return this.billingService.purchaseTokens(dto);
  }

  @Post('tokens/purchase/:purchaseId/confirm')
  @ApiOperation({ summary: 'Confirm token purchase' })
  @ApiResponse({ status: 201, description: 'Token purchase confirmed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  async confirmTokenPurchase(@Param('purchaseId') purchaseId: string) {
    await this.billingService.confirmTokenPurchase(purchaseId);
    return { message: 'Token purchase confirmed' };
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
  async getAutoTopupConfig(@CurrentTenantId() _tenantId: string) {
    return { message: 'Get auto topup config endpoint' };
  }

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Get available subscription plans' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  async getPlans() {
    return {
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          description: 'Perfect for small projects',
          monthlyPrice: 29,
          includedTokens: 10000,
          overageRate: 0.001,
          features: [
            '10,000 notifications/month',
            'Email & SMS support',
            'Basic analytics',
            'API access',
          ],
        },
        {
          id: 'professional',
          name: 'Professional',
          description: 'Great for growing businesses',
          monthlyPrice: 99,
          includedTokens: 50000,
          overageRate: 0.0008,
          features: [
            '50,000 notifications/month',
            'All notification channels',
            'Advanced analytics',
            'Priority support',
            'Custom templates',
          ],
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'For large scale operations',
          monthlyPrice: 299,
          includedTokens: 200000,
          overageRate: 0.0005,
          features: [
            '200,000 notifications/month',
            'All notification channels',
            'Real-time analytics',
            'Dedicated support',
            'Custom integrations',
            'SLA guarantee',
          ],
        },
        {
          id: 'pay_as_you_go',
          name: 'Pay as you Go',
          description: 'Only pay for what you use',
          monthlyPrice: 0,
          includedTokens: 0,
          overageRate: 0.002,
          features: [
            'No monthly commitment',
            'All notification channels',
            'Basic analytics',
            'API access',
          ],
        },
      ],
    };
  }

  @Get('token-packages')
  @Public()
  @ApiOperation({ summary: 'Get available pay-as-you-go token packages (USD + NGN shelves)' })
  @ApiResponse({ status: 200, description: 'Token packages retrieved successfully' })
  async getTokenPackages() {
    const usdManaged = [
      { id: 'usd-3000', tokens: 3000, price: 1, pricePerToken: 1 / 3000, savings: 0, currency: 'USD' },
      { id: 'usd-15000', tokens: 15000, price: 5, pricePerToken: 5 / 15000, savings: 0, currency: 'USD' },
      { id: 'usd-60000', tokens: 60000, price: 20, pricePerToken: 20 / 60000, savings: 0, currency: 'USD' },
      { id: 'usd-300000', tokens: 300000, price: 90, pricePerToken: 90 / 300000, savings: 10, currency: 'USD' },
    ];
    const ngnManaged = [
      { id: 'ngn-3000', tokens: 3000, price: 1000, pricePerToken: 1000 / 3000, savings: 0, currency: 'NGN' },
      { id: 'ngn-15000', tokens: 15000, price: 5000, pricePerToken: 5000 / 15000, savings: 0, currency: 'NGN' },
      { id: 'ngn-60000', tokens: 60000, price: 20000, pricePerToken: 20000 / 60000, savings: 0, currency: 'NGN' },
      { id: 'ngn-300000', tokens: 300000, price: 90000, pricePerToken: 90000 / 300000, savings: 10, currency: 'NGN' },
    ];
    const usdByo = [
      { id: 'byo-usd-1250', tokens: 1250, price: 1, pricePerToken: 1 / 1250, savings: 0, currency: 'USD', kind: 'byo' },
      { id: 'byo-usd-6250', tokens: 6250, price: 5, pricePerToken: 5 / 6250, savings: 0, currency: 'USD', kind: 'byo' },
      { id: 'byo-usd-25000', tokens: 25000, price: 20, pricePerToken: 20 / 25000, savings: 0, currency: 'USD', kind: 'byo' },
      { id: 'byo-usd-123750', tokens: 123750, price: 90, pricePerToken: 90 / 123750, savings: 10, currency: 'USD', kind: 'byo' },
    ];
    const ngnByo = [
      { id: 'byo-ngn-1250', tokens: 1250, price: 1000, pricePerToken: 1000 / 1250, savings: 0, currency: 'NGN', kind: 'byo' },
      { id: 'byo-ngn-6250', tokens: 6250, price: 5000, pricePerToken: 5000 / 6250, savings: 0, currency: 'NGN', kind: 'byo' },
      { id: 'byo-ngn-25000', tokens: 25000, price: 20000, pricePerToken: 20000 / 25000, savings: 0, currency: 'NGN', kind: 'byo' },
      { id: 'byo-ngn-123750', tokens: 123750, price: 90000, pricePerToken: 90000 / 123750, savings: 10, currency: 'NGN', kind: 'byo' },
    ];

    return {
      packages: [...usdManaged, ...ngnManaged, ...usdByo, ...ngnByo],
      shelves: {
        managed: { USD: usdManaged, NGN: ngnManaged },
        byo: { USD: usdByo, NGN: ngnByo },
      },
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

  @Post('webhooks/polar')
  @Public()
  @ApiOperation({ summary: 'Handle Polar webhooks' })
  async handlePolarWebhook(@Body() payload: any, @Request() req) {
    const signature = req.headers['polar-signature'];
    const event = await this.polarService.handleWebhook(payload, signature);
    await this.processWebhookEvent('polar', event);
    return { received: true };
  }

  @Post('webhooks/paystack')
  @Public()
  @ApiOperation({ summary: 'Handle Paystack webhooks' })
  async handlePaystackWebhook(@Body() payload: any, @Request() req) {
    const signature = req.headers['x-paystack-signature'];
    const event = await this.paystackService.handleWebhook(payload, signature);
    await this.processWebhookEvent('paystack', event);
    return { received: true };
  }

  private async processWebhookEvent(provider: string, event: any) {
    try {
      switch (event.type || event.event) {
        case 'payment_intent.succeeded':
        case 'charge.success':
          await this.handleSuccessfulPayment(event);
          break;
        case 'subscription.created':
        case 'subscription.create':
          await this.handleSubscriptionCreated(event);
          break;
        case 'subscription.updated':
        case 'subscription.update':
          await this.handleSubscriptionUpdated(event);
          break;
        case 'subscription.cancelled':
        case 'subscription.disable':
          await this.handleSubscriptionCancelled(event);
          break;
        default:
          console.log(`Unhandled ${provider} webhook event: ${event.type || event.event}`);
      }
    } catch (error) {
      console.error(`Failed to process ${provider} webhook:`, error);
      throw error;
    }
  }

  private async handleSuccessfulPayment(event: any) {
    const metadata = event.data?.metadata || event.metadata;
    if (metadata?.purchaseId) {
      await this.billingService.confirmTokenPurchase(metadata.purchaseId);
    }
  }

  private async handleSubscriptionCreated(event: any) {
    console.log('Subscription created:', event);
  }

  private async handleSubscriptionUpdated(event: any) {
    console.log('Subscription updated:', event);
  }

  private async handleSubscriptionCancelled(event: any) {
    console.log('Subscription cancelled:', event);
  }
}
