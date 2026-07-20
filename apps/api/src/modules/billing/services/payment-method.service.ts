import {

  BadRequestException,

  Injectable,

  Logger,

  NotFoundException,

} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { randomUUID } from 'node:crypto';

import { Repository } from 'typeorm';

import {

  TenantPaymentMethod,

  TenantPaymentMethodStatus,

} from '../entities/tenant-payment-method.entity';

import { PaymentProvider } from '../enums/payment-provider.enum';

import { Tenant } from '../../tenant/entities/tenant.entity';

import { BachsService } from './bachs.service';

import { PolarService } from './polar.service';

import { NombaService } from './nomba.service';

import {

  BillingCurrency,

  buildNotifiPaymentMethodSetupReference,

  buildNotifiPurchaseReference,

  resolvePackage,

} from '../constants/token-packages';



export interface PaymentMethodSetupResult {

  setupReference: string;

  checkoutUrl: string;

  provider: PaymentProvider;

}



export interface OffSessionChargeResult {

  status: 'success' | 'pending' | 'failed';

  providerReference?: string;

  errorCode?: string;

}



@Injectable()

export class PaymentMethodService {

  private readonly logger = new Logger(PaymentMethodService.name);



  constructor(

    @InjectRepository(TenantPaymentMethod)

    private paymentMethodRepository: Repository<TenantPaymentMethod>,

    @InjectRepository(Tenant)

    private tenantRepository: Repository<Tenant>,

    private bachsService: BachsService,

    private polarService: PolarService,

    private nombaService: NombaService,

  ) {}



  async listPaymentMethods(tenantId: string): Promise<TenantPaymentMethod[]> {

    return this.paymentMethodRepository.find({

      where: { tenantId, status: TenantPaymentMethodStatus.ACTIVE },

      order: { isDefault: 'DESC', createdAt: 'DESC' },

    });

  }



  async startPaymentMethodSetup(

    tenantId: string,

    currency: BillingCurrency,

  ): Promise<PaymentMethodSetupResult> {

    const tenant = await this.requireTenant(tenantId);

    const email = tenant.owner?.email;



    if (!email) {

      throw new BadRequestException('Tenant owner email is required to save a card');

    }



    const setupReference = randomUUID();

    const provider = this.resolveSetupProvider(currency);

    const tenantSlug = tenant.subdomain;

    const reference = buildNotifiPaymentMethodSetupReference(setupReference);

    const metadata = {

      purpose: 'payment_method_setup',

      setup_reference: setupReference,

      tenant_id: tenantId,

      currency,

    };



    if (provider === PaymentProvider.NOMBA) {

      const { successUrl } = this.nombaService.buildPaymentMethodSetupUrls(

        tenantSlug,

        setupReference,

      );

      const checkout = await this.nombaService.createCheckoutOrder({

        orderReference: reference,

        amount: this.nombaService.getCardSetupAmount(),

        currency: 'NGN',

        customerEmail: email,

        callbackUrl: successUrl,

        tokenizeCard: true,

        orderMetaData: metadata,

        allowedPaymentMethods: ['Card'],

      });



      return {

        setupReference,

        checkoutUrl: checkout.checkoutUrl,

        provider,

      };

    }



    const productId = this.polarService.getCardVaultProductId();

    if (!productId) {

      throw new BadRequestException('Polar card vault product is not configured');

    }



    const checkout = await this.polarService.createPaymentMethodSetupCheckout({

      productId,

      email,

      successUrl: this.polarService.buildPaymentMethodSetupSuccessUrl(

        tenantSlug,

        setupReference,

      ),

      metadata,

      externalCustomerId: tenantId,

    });



    return {

      setupReference,

      checkoutUrl: checkout.checkoutUrl,

      provider,

    };

  }



  async saveFromProvider(input: {

    tenantId: string;

    provider: PaymentProvider;

    currency: BillingCurrency;

    externalCustomerId: string;

    externalPaymentMethodId?: string;

    cardBrand?: string;

    cardLast4?: string;

    cardExpMonth?: number;

    cardExpYear?: number;

    makeDefault?: boolean;

  }): Promise<TenantPaymentMethod> {

    if (input.makeDefault !== false) {

      await this.paymentMethodRepository.update(

        { tenantId: input.tenantId, isDefault: true },

        { isDefault: false },

      );

    }



    const method = this.paymentMethodRepository.create({

      tenantId: input.tenantId,

      provider: input.provider,

      currency: input.currency,

      externalCustomerId: input.externalCustomerId,

      externalPaymentMethodId: input.externalPaymentMethodId,

      cardBrand: input.cardBrand,

      cardLast4: input.cardLast4,

      cardExpMonth: input.cardExpMonth,

      cardExpYear: input.cardExpYear,

      status: TenantPaymentMethodStatus.ACTIVE,

      isDefault: input.makeDefault !== false,

    });



    return this.paymentMethodRepository.save(method);

  }



  async revokePaymentMethod(tenantId: string, paymentMethodId: string): Promise<void> {

    const method = await this.paymentMethodRepository.findOne({

      where: { id: paymentMethodId, tenantId },

    });



    if (!method) {

      throw new NotFoundException('Payment method not found');

    }



    method.status = TenantPaymentMethodStatus.REVOKED;

    method.isDefault = false;

    await this.paymentMethodRepository.save(method);

  }



  async chargeOffSession(input: {

    tenantId: string;

    purchaseId: string;

    packageId: string;

    currency: BillingCurrency;

    paymentMethod: TenantPaymentMethod;

    customerEmail: string;

  }): Promise<OffSessionChargeResult> {

    const pkg = resolvePackage(input.packageId, input.currency);



    if (input.paymentMethod.provider === PaymentProvider.POLAR) {

      return this.polarService.chargeOffSession({

        customerId: input.paymentMethod.externalCustomerId,

        productId: this.polarService.getTokenProductId()!,

        amountMinor: Math.round(pkg.price * 100),

        currency: input.currency,

        paymentMethodId: input.paymentMethod.externalPaymentMethodId,

        metadata: {

          purchaseId: input.purchaseId,

          purchase_id: input.purchaseId,

          tenantId: input.tenantId,

          tenant_id: input.tenantId,

          packageId: input.packageId,

          package_id: input.packageId,

          currency: input.currency,

          token_amount: String(pkg.tokens),

          purpose: 'auto_topup',

        },

      });

    }



    if (input.paymentMethod.provider === PaymentProvider.NOMBA) {

      const tokenKey = input.paymentMethod.externalPaymentMethodId;

      if (!tokenKey) {

        return { status: 'failed', errorCode: 'nomba_token_missing' };

      }



      const orderReference = buildNotifiPurchaseReference(input.purchaseId);

      const { successUrl } = this.nombaService.buildCheckoutUrls('', input.purchaseId);



      return this.nombaService.chargeTokenizedCard({

        tokenKey,

        orderReference,

        amount: pkg.price,

        currency: 'NGN',

        customerEmail: input.customerEmail,

        callbackUrl: successUrl,

        orderMetaData: {

          purchase_id: input.purchaseId,

          tenant_id: input.tenantId,

          package_id: input.packageId,

          currency: input.currency,

          token_amount: String(pkg.tokens),

          purpose: 'auto_topup',

        },

      });

    }



    return this.bachsService.chargeOffSession({

      customerId: input.paymentMethod.externalCustomerId,

      paymentMethodId: input.paymentMethod.externalPaymentMethodId,

      purchaseId: input.purchaseId,

      packageId: input.packageId,

      currency: input.currency,

      tokenAmount: pkg.tokens,

      priceMinor: Math.round(pkg.price * 100),

    });

  }



  private resolveSetupProvider(currency: BillingCurrency): PaymentProvider {

    if (currency === 'NGN' && this.nombaService.isConfigured()) {

      return PaymentProvider.NOMBA;

    }

    if (currency === 'USD' && this.polarService.isCardVaultConfigured()) {

      return PaymentProvider.POLAR;

    }

    if (currency === 'USD' && this.polarService.isConfigured()) {

      return PaymentProvider.POLAR;

    }

    throw new BadRequestException(`No card vault provider configured for ${currency}`);

  }



  private async requireTenant(tenantId: string): Promise<Tenant> {

    const tenant = await this.tenantRepository.findOne({

      where: { id: tenantId },

      relations: ['owner'],

    });



    if (!tenant) {

      throw new NotFoundException('Tenant not found');

    }



    return tenant;

  }

}


