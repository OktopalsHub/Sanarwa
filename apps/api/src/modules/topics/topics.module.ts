import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Topic, TopicSubscription } from "./entities/topic.entity";
import { TopicsService } from "./topics.service";
import { TopicsController } from "./topics.controller";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";

@Module({
  imports: [TypeOrmModule.forFeature([Topic, TopicSubscription]), TenantMemberModule],
  controllers: [TopicsController],
  providers: [TopicsService],
  exports: [TopicsService],
})
export class TopicsModule {}
