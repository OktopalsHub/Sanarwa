import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { ApiKeyService } from "./api-key.service";
import { ApiKeyResponseDto, ApiKeyListResponseDto } from "./dto/api-key-response.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { UpdateApiKeyDto } from "./dto/update-api-key.dto";
import { ApiKeyQueryDto } from "./dto/api-key-query.dto";
import { CurrentMemberId, CurrentTenantId } from "src/common/decorators";
import { TenantMemberGuard } from "src/common/guards";
import { AuthGuard } from "src/modules/auth/guards/jwt-auth.guard";

@ApiTags("API Keys")
@ApiBearerAuth()
@Controller("tenants/:tenantId/projects/:projectId/api-keys")
@UseGuards(AuthGuard, TenantMemberGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new API key",
    description: "Create a new API key for a project with specified permissions and rate limits",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "API key created successfully",
    type: ApiKeyResponseDto,
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
  @ApiResponse({
    status: 404,
    description: "Project not found",
  })
  async createApiKey(
    @Param("tenantId") tenantId: string,
    @CurrentMemberId() memberId: string,
    @Param("projectId") projectId: string,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.createApiKey(tenantId, projectId, memberId, createApiKeyDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all API keys for a project",
    description: "Retrieve a list of API keys for a specific project",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "List of API keys retrieved successfully",
    type: [ApiKeyListResponseDto],
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
  async getApiKeys(@Param("tenantId") tenantId: string, @Param("projectId") projectId: string) {
    return this.apiKeyService.getApiKeys(tenantId, projectId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get API key by ID",
    description: "Retrieve a specific API key by its unique identifier",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "API key unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "API key retrieved successfully",
    type: ApiKeyResponseDto,
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
    description: "API key not found",
  })
  async getApiKey(
    @Param("tenantId") tenantId: string,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ) {
    const apiKeys = await this.apiKeyService.getApiKeys(tenantId, projectId);
    const apiKey = apiKeys.find((k) => k.id === id);

    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }

    return apiKey;
  }

  @Put(":id")
  @ApiOperation({
    summary: "Update API key",
    description: "Update API key information (name, status, permissions, rate limits, etc.)",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "API key unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "API key updated successfully",
    type: ApiKeyResponseDto,
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
    description: "Forbidden - User does not have permission to update this API key",
  })
  @ApiResponse({
    status: 404,
    description: "API key not found",
  })
  async updateApiKey(
    @Param("tenantId") tenantId: string,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
    @Body() updateApiKeyDto: UpdateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.updateApiKey(id, tenantId, projectId, updateApiKeyDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Revoke API key",
    description: "Revoke an API key (mark as inactive)",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "API key unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 204,
    description: "API key revoked successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User does not have permission to revoke this API key",
  })
  @ApiResponse({
    status: 404,
    description: "API key not found",
  })
  async revokeApiKey(
    @Param("tenantId") tenantId: string,
    @Param("projectId") projectId: string,
    @Param("id") id: string,
  ): Promise<void> {
    await this.apiKeyService.revokeApiKey(id, tenantId, projectId);
  }
}
