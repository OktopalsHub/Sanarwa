import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "../auth/auth.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { TopicsModule } from "../topics/topics.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";
import { Campaign } from "./entities/campaign.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign]),
    EventEmitterModule,
    AuthModule,
    TenantMemberModule,
    TopicsModule,
    NotificationsModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
