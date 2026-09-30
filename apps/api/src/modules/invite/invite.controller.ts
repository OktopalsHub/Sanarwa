import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentMemberId, CurrentTenantId } from "src/common/decorators";
import { TenantMemberGuard } from "src/common/guards";
import { AuthGuard } from "src/modules/auth/guards/jwt-auth.guard";
import { CreateInviteDto } from "./dto/create-invite.dto";
import { InviteQueryDto } from "./dto/invite-query.dto";
import { InviteService } from "./invite.service";

@ApiTags("Invites")
@ApiBearerAuth()
@Controller("tenants/:tenantId/invites")
@UseGuards(AuthGuard, TenantMemberGuard)
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @ApiOperation({ summary: "Create a new invitation" })
  @ApiResponse({ status: 201, description: "Invitation created successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createInvite(
    @CurrentTenantId() tenantId: string,
    @CurrentMemberId() invitedById: string,
    @Body() createInviteDto: CreateInviteDto,
  ) {
    return this.inviteService.createInvite(tenantId, invitedById, createInviteDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all invitations for tenant with pagination" })
  @ApiResponse({ status: 200, description: "Invitations retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getInvitesByTenant(@CurrentTenantId() tenantId: string, @Query() query: InviteQueryDto) {
    return this.inviteService.getTenantInvites(tenantId, query);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cancel an invitation" })
  @ApiParam({ name: "id", description: "Invitation ID" })
  @ApiResponse({ status: 204, description: "Invitation cancelled successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Invitation not found" })
  async cancelInvite(@CurrentTenantId() tenantId: string, @Param("id") inviteId: string) {
    await this.inviteService.cancelInvite(tenantId, inviteId);
  }
}
