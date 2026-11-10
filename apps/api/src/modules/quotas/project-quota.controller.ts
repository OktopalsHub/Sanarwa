import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Project } from "../project/entities/project.entity";
import { ProjectQuotaService } from "./project-quota.service";
import { UpsertProjectQuotaDto } from "./dto/project-quota.dto";

@ApiTags("Project Send Quotas")
@ApiBearerAuth()
@Controller("projects/:id/send-quota")
@UseGuards(AuthGuard)
export class ProjectQuotaController {
  constructor(
    private readonly projectQuota: ProjectQuotaService,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get per-project send quota status" })
  @ApiResponse({ status: 200, description: "Quota status" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async getStatus(@Param("id") projectId: string, @CurrentUser() user: any) {
    const tenantId = await this.tenantForProject(projectId, user);
    return this.projectQuota.getStatus(projectId, tenantId);
  }

  @Put()
  @ApiOperation({ summary: "Create or update the per-project send quota" })
  @ApiResponse({ status: 200, description: "Quota saved" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async upsert(
    @Param("id") projectId: string,
    @CurrentUser() user: any,
    @Body() dto: UpsertProjectQuotaDto,
  ) {
    const tenantId = await this.tenantForProject(projectId, user);
    return this.projectQuota.upsertQuota({
      tenantId,
      projectId,
      limit: dto.limit,
      windowSeconds: dto.windowSeconds,
      enabled: dto.enabled,
    });
  }

  @Delete()
  @ApiOperation({ summary: "Remove the per-project send quota (unbounded)" })
  @ApiResponse({ status: 200, description: "Quota removed" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async remove(@Param("id") projectId: string, @CurrentUser() user: any) {
    await this.tenantForProject(projectId, user);
    await this.projectQuota.deleteQuota(projectId);
    return { projectId, removed: true };
  }

  private async tenantForProject(projectId: string, user: any): Promise<string> {
    const tenantId: string | undefined = user?.tenantId ?? user?.organizationId;
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project || (tenantId && project.tenantId !== tenantId)) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project.tenantId;
  }
}
