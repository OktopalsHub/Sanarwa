import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Project } from './entities/project.entity';
import { ProjectController } from './project.controller';
import { ProjectApiController } from './project-api.controller';
import { ProjectRepository } from './project.repository';
import { ProjectService } from './project.service';
import { TenantMemberModule } from '../tenant-member/tenant-member.module';
import { TenantModule } from '../tenant/tenant.module';
import { ProviderModule } from '../provider/provider.module';
import { TokenManagementModule } from '../token-management/token-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project]),
    AuthModule,
    TenantModule,
    TenantMemberModule,
    ProviderModule,
    TokenManagementModule,
  ],
  controllers: [ProjectController, ProjectApiController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
