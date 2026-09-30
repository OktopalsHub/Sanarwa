import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  Patch,
  Post,
  Query,
  UseGuards,
  Param,
} from "@nestjs/common";
import { AuthGuard } from "../../auth/guards/jwt-auth.guard";
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { CurrentMember, CurrentTenantId } from "src/common/decorators";
import { IPaginatedData } from "src/common/dto/pagination.dto";
import { TenantMemberGuard } from "src/common/guards";
import {
  AuthenticatedRequest,
  MemberContext,
} from "src/common/interfaces/request-context.interface";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { TenantMemberResponseDto, UserTenantsQueryDto } from "../../tenant-member/dto";
import { TenantMemberService } from "../../tenant-member/tenant-member.service";
import { CreateTenantDto } from "../dto/create-tenant.dto";
import { TenantQueryDto } from "../dto/tenant-query.dto";
import { UpdateTenantDto } from "../dto/update-tenant.dto";
import { TenantResponseDto, TenantListResponseDto } from "../dto/tenant-response.dto";
import { TenantService } from "../tenant.service";

@ApiTags("Tenants")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("tenants")
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantMemberService: TenantMemberService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new tenant",
    description: "Create a new tenant workspace for the authenticated user",
  })
  @ApiCreatedResponse({
    description: "Tenant created successfully",
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input or subdomain already exists",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async createTenant(
    @CurrentUser() req: AuthenticatedRequest,
    @Body() createTenantDto: CreateTenantDto,
  ) {
    return this.tenantService.createTenant(req.auth.principalId, createTenantDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all tenants",
    description: "Retrieve a paginated list of all tenants with optional filtering and sorting",
  })
  @ApiResponse({
    status: 200,
    description: "Tenants retrieved successfully",
    schema: {
      properties: {
        records: {
          type: "array",
          items: { $ref: "#/components/schemas/TenantListResponseDto" },
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
  async getTenants(@Query() query: TenantQueryDto) {
    return this.tenantService.getTenants(query);
  }

  @Get("me")
  @ApiOperation({
    summary: "Get current user tenants",
    description: "Retrieve all tenants that the current user belongs to (paginated)",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of tenants the user is a member of",
    schema: {
      properties: {
        records: {
          type: "array",
          items: { $ref: "#/components/schemas/TenantMemberResponseDto" },
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
  async getMyTenants(
    @CurrentUser() req: AuthenticatedRequest,
    @Query() query: UserTenantsQueryDto,
  ): Promise<IPaginatedData<TenantMemberResponseDto>> {
    return this.tenantMemberService.getUserTenantsPaginated(req.user.id, query);
  }

  @Get("current")
  @ApiOperation({
    summary: "Get current tenant",
    description:
      "Returns the tenant from X-Tenant-ID when set, otherwise the user's most recently joined tenant",
  })
  @ApiResponse({
    status: 200,
    description: "Current tenant retrieved successfully",
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of the requested tenant",
  })
  @ApiResponse({
    status: 404,
    description: "No tenant found for user",
  })
  async getCurrentTenant(
    @CurrentUser() req: AuthenticatedRequest,
    @Headers("x-tenant-id") tenantIdHeader?: string,
  ) {
    const userId = req.user.id;

    if (tenantIdHeader) {
      const member = await this.tenantMemberService.getMemberByUserId(tenantIdHeader, userId);
      if (!member) {
        throw new ForbiddenException("User is not a member of this tenant");
      }
      return this.tenantService.getTenantById(tenantIdHeader);
    }

    const memberships = await this.tenantMemberService.getUserTenants(userId);
    const first = memberships[0];
    if (!first?.tenant?.id) {
      throw new NotFoundException("No tenant found for user");
    }

    return this.tenantService.getTenantById(first.tenant.id);
  }

  @Get(":tenantId")
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: "Get tenant by ID",
    description: "Retrieve a specific tenant by its unique identifier",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Tenant retrieved successfully",
    type: TenantResponseDto,
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
    description: "Tenant not found",
  })
  async getTenantById(@Param("tenantId") tenantId: string, @CurrentMember() member: MemberContext) {
    return this.tenantService.getTenantById(tenantId);
  }

  @Patch(":tenantId")
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: "Update tenant",
    description: "Update tenant information (name, subdomain, status, etc.)",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Tenant updated successfully",
    type: TenantResponseDto,
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
    description: "Forbidden - User does not have permission to update this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Tenant not found",
  })
  async updateTenant(
    @Param("tenantId") tenantId: string,
    @CurrentMember() member: MemberContext,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantService.updateTenant(tenantId, updateTenantDto);
  }

  @Patch(":tenantId/suspend")
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: "Suspend tenant",
    description: "Suspend a tenant (disable all operations)",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Tenant suspended successfully",
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User does not have permission to suspend this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Tenant not found",
  })
  async suspendTenant(@Param("tenantId") tenantId: string, @CurrentMember() member: MemberContext) {
    return this.tenantService.suspendTenant(tenantId);
  }

  @Patch(":tenantId/activate")
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: "Activate tenant",
    description: "Activate a suspended tenant",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Tenant activated successfully",
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User does not have permission to activate this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Tenant not found",
  })
  async activateTenant(
    @Param("tenantId") tenantId: string,
    @CurrentMember() member: MemberContext,
  ) {
    return this.tenantService.activateTenant(tenantId);
  }

  @Delete(":tenantId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(TenantMemberGuard)
  @ApiOperation({
    summary: "Delete tenant",
    description: "Permanently delete a tenant and all associated data",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 204,
    description: "Tenant deleted successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User does not have permission to delete this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Tenant not found",
  })
  async removeTenant(@Param("tenantId") tenantId: string, @CurrentMember() member: MemberContext) {
    await this.tenantService.removeTenant(tenantId);
  }
}
