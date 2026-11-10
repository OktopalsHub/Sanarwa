import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Project } from "../project/entities/project.entity";
import { ProviderModule } from "../provider/provider.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";

@Module({
  imports: [TypeOrmModule.forFeature([Project]), ProviderModule, TenantMemberModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
