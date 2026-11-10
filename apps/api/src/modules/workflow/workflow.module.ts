import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { Workflow } from "./entities/workflow.entity";
import { WorkflowRun } from "./entities/workflow-run.entity";
import { WorkflowService } from "./workflow.service";
import { WorkflowController } from "./workflow.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, WorkflowRun]),
    AuthModule,
    TenantMemberModule,
    NotificationsModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
