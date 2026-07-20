import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordService } from '../../common/helpers/password.service';
import { AuthModule } from '../auth/auth.module';
import { TenantMemberModule } from '../tenant-member/tenant-member.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';
import { Invite } from './entities/invite.entity';
import { InviteController } from './invite.controller';
import { InviteRepository } from './invite.repository';
import { InviteService } from './invite.service';
import { PublicInviteController } from './public-invite.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite]),
    UserModule,
    TenantMemberModule,
    TenantModule,
    AuthModule,
  ],
  controllers: [InviteController, PublicInviteController],
  providers: [InviteService, InviteRepository, PasswordService],
  exports: [InviteService, InviteRepository],
})
export class InviteModule { }
