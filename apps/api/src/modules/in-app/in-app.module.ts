import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { InAppNotification } from "../messaging/entities/in-app-notification.entity";
import { InAppInboxController } from "./controllers/in-app-inbox.controller";
import { InAppGateway } from "./gateway/in-app.gateway";
import { InAppFeedService } from "./services/in-app-feed.service";

@Module({
  imports: [TypeOrmModule.forFeature([InAppNotification]), JwtModule.register({}), AuthModule, TenantMemberModule, EventEmitterModule],
  controllers: [InAppInboxController],
  providers: [InAppGateway, InAppFeedService],
  exports: [InAppGateway, InAppFeedService],
})
export class InAppModule {}
