import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { AuthModule } from '../../modules/auth/auth.module';
import { AuditController } from './controllers/audit.controller';

import { SecurityEventEntity } from './entities/security-event.entity';

import { EncryptionService } from './services/encryption.service';
import { InputSanitizationService } from './services/input-sanitization.service';
import { SecurityEventService } from './services/security-event.service';
import { SessionSecurityService } from './services/session-security.service';
import { AuditLogModule } from './audit-log.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SecurityEventEntity, User]),
    AuthModule,
    AuditLogModule
  ],
  controllers: [AuditController],
  providers: [
    EncryptionService,
    SecurityEventService,
    InputSanitizationService,
    SessionSecurityService,
  ],
  exports: [
    EncryptionService,
    SecurityEventService,
    InputSanitizationService,
    SessionSecurityService,
  ],
})
export class SecurityModule { }
