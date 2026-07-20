import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantMemberGuard } from 'src/common/guards';
import { AuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { UpdateTenantMemberDto } from '../tenant/dto/update-tenant-member.dto';
import { TenantMemberQueryDto } from './dto/tenant-member-query.dto';
import { TenantMemberResponseDto } from './dto/tenant-member-response.dto';
import { TenantMemberService } from './tenant-member.service';

@ApiTags('Tenant Members')
@ApiBearerAuth()
@Controller('tenants/:tenantId')
@UseGuards(AuthGuard, TenantMemberGuard)
export class TenantMemberController {
  constructor(private readonly tenantMemberService: TenantMemberService) { }

  @Get('members')
  @ApiOperation({
    summary: 'Get all tenant members',
    description: 'Retrieve a paginated list of all members in a tenant with optional filtering and sorting',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant members retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a member of this tenant',
  })
  async getMembers(
    @Param('tenantId') tenantId: string,
    @Query() query: TenantMemberQueryDto,
  ) {
    return this.tenantMemberService.getTenantMembers(tenantId, query);
  }

  @Get('members/:memberId')
  @ApiOperation({
    summary: 'Get tenant member by ID',
    description: 'Retrieve a specific tenant member by their unique identifier',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'memberId',
    description: 'Tenant member unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant member retrieved successfully',
    type: TenantMemberResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a member of this tenant',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant member not found',
  })
  async getMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.tenantMemberService.getTenantMemberById(tenantId, memberId);
  }

  @Patch('members/:memberId')
  @ApiOperation({
    summary: 'Update tenant member',
    description: 'Update tenant member information (role, status, permissions, etc.)',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'memberId',
    description: 'Tenant member unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant member updated successfully',
    type: TenantMemberResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have permission to update this member',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant member not found',
  })
  async updateMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberDto: UpdateTenantMemberDto,
  ) {
    return this.tenantMemberService.updateTenantMember(
      tenantId,
      memberId,
      updateMemberDto,
    );
  }

  @Delete('members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove tenant member',
    description: 'Remove a member from the tenant',
  })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'memberId',
    description: 'Tenant member unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Tenant member removed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have permission to remove this member',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant member not found',
  })
  async removeMember(
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.tenantMemberService.removeTenantMember(tenantId, memberId);
  }
}
