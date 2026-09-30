import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKeyService } from './api-key.service';
import { ApiKey } from './entities/api-key.entity';
import { TenantMemberModule } from '../tenant-member/tenant-member.module';
import { TenantModule } from '../tenant/tenant.module';
import { TokenManagementModule } from '../token-management/token-management.module';
import { ApiKeyStrategy } from '../auth/strategies/api-key.strategy';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey]),
    PassportModule,
    TenantModule,
    TenantMemberModule,
    TokenManagementModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_AUTH_SECRET'),
        signOptions: { expiresIn: '60m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyRepository, ApiKeyStrategy, ApiKeyAuthGuard],
  exports: [ApiKeyService, ApiKeyAuthGuard],
})
export class ApiKeyModule {}
