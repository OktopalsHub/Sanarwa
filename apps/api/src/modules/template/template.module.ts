import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Template } from "./template.entity";
import { TemplateVersion } from "./entities/template-version.entity";
import { TemplateService } from "./template.service";
import { TemplateValidatorService } from "./services/template-validator.service";
import { TemplateRendererService } from "./services/template-renderer.service";
import { TemplateVersioningService } from "./services/template-versioning.service";
import { TemplateProjectService } from "./services/template-project.service";
import { TemplateCacheService } from "./services/template-cache.service";
import { ProjectRepository } from "../project/project.repository";
import { Project } from "../project/entities/project.entity";
import { TEMPLATE_REPO } from "./template.tokens";
import { BaseRepository } from "../../common/database/repositories/base.repository";

@Module({
  imports: [TypeOrmModule.forFeature([Template, TemplateVersion, Project]), ConfigModule],
  controllers: [],
  providers: [
    {
      provide: TEMPLATE_REPO,
      useFactory: (repository: never) => new BaseRepository<Template>(repository),
      inject: [getRepositoryToken(Template)],
    },
    ProjectRepository,
    TemplateValidatorService,
    TemplateRendererService,
    TemplateVersioningService,
    TemplateProjectService,
    TemplateCacheService,
    TemplateService,
  ],
  exports: [TemplateService, TypeOrmModule],
})
export class TemplateModule {}
