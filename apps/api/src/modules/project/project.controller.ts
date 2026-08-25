import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { CurrentMemberId } from "src/common/decorators";
import { TenantMemberGuard } from "src/common/guards";
import { AuthGuard } from "src/modules/auth/guards/jwt-auth.guard";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectQueryDto } from "./dto/project-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectResponseDto } from "./dto/project-response.dto";
import { ProjectService } from "./project.service";

@ApiTags("Projects")
@ApiBearerAuth()
@Controller("tenants/:tenantId/projects")
@UseGuards(AuthGuard, TenantMemberGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new project",
    description: "Create a new project within a tenant",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Project created successfully",
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  async createProject(
    @Param("tenantId") tenantId: string,
    @CurrentMemberId() memberId: string,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    return this.projectService.createProject(tenantId, createProjectDto, memberId);
  }

  @Get()
  @ApiOperation({
    summary: "Get all projects for a tenant",
    description:
      "Retrieve a paginated list of projects for a specific tenant with optional filtering and sorting",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "List of projects retrieved successfully",
    schema: {
      properties: {
        records: {
          type: "array",
          items: { $ref: "#/components/schemas/ProjectListResponseDto" },
        },
        total: { type: "number" },
        page: { type: "number" },
        limit: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  async getAllProjects(@Param("tenantId") tenantId: string, @Query() query: ProjectQueryDto) {
    return this.projectService.getAllProjects(tenantId, query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get project by ID",
    description: "Retrieve a specific project by its unique identifier",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Project retrieved successfully",
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Project not found",
  })
  async getProjectById(@Param("tenantId") tenantId: string, @Param("id") id: string) {
    return this.projectService.getProjectById(tenantId, id);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Update project",
    description: "Update project information (name, description, settings, etc.)",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Project updated successfully",
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User does not have permission to update this project",
  })
  @ApiResponse({
    status: 404,
    description: "Project not found",
  })
  async updateProject(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(tenantId, id, updateProjectDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete project",
    description: "Permanently delete a project and all associated data",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 204,
    description: "Project deleted successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User does not have permission to delete this project",
  })
  @ApiResponse({
    status: 404,
    description: "Project not found",
  })
  async deleteProject(@Param("tenantId") tenantId: string, @Param("id") id: string) {
    return this.projectService.deleteProject(tenantId, id);
  }
}
