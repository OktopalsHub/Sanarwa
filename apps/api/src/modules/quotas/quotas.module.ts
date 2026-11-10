import { MessagingEntitiesModule } from "../messaging/shared/messaging-entities.module";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProjectSendQuota } from "./entities/project-send-quota.entity";
import { Project } from "../project/entities/project.entity";
import { ProjectQuotaService } from "./project-quota.service";
import { ProjectQuotaController } from "./project-quota.controller";

@Module({
  imports: [TypeOrmModule.forFeature([ProjectSendQuota, Project]), MessagingEntitiesModule],
  controllers: [ProjectQuotaController],
  providers: [ProjectQuotaService],
  exports: [ProjectQuotaService],
})
export class QuotasModule {}
