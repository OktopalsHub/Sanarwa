import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { provideBaseRepository } from '../../database/repositories/provide-base-repository';
import { TenantMemberModule } from '../tenant-member/tenant-member.module';
import { AuthModule } from '../auth/auth.module';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { BRAND_REPO } from './brand.tokens';
import { Brand } from './entities/brand.entity';
import { DnsVerificationService } from './services/dns-verification.service';
import { SESVerificationService } from './services/ses-verification.service';
import { ResendVerificationService } from './services/resend-verification.service';
import { CloudflareDNSService } from './services/cloudflare-dns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Brand]),
    AuthModule,
    TenantMemberModule,
  ],
  controllers: [BrandController],
  providers: [
    BrandService,
    provideBaseRepository(Brand, BRAND_REPO),
    DnsVerificationService,
    SESVerificationService,
    ResendVerificationService,
    CloudflareDNSService,
  ],
  exports: [
    BrandService,
    BRAND_REPO,
    DnsVerificationService,
    SESVerificationService,
    ResendVerificationService,
    CloudflareDNSService,
  ],
})
export class BrandModule {}
