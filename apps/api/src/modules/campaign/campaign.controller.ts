import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentMemberId, CurrentTenantId } from "src/common/decorators";
import { TenantMemberGuard } from "src/common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { CampaignService } from "./campaign.service";
import { CampaignQueryDto } from "./dto/campaign-query.dto";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

@ApiTags("Campaigns")
@ApiBearerAuth()
@Controller("tenants/:tenantId/campaigns")
@UseGuards(AuthGuard, TenantMemberGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a campaign" })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentMemberId() memberId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaignService.create(tenantId, dto, memberId);
  }

  @Get()
  @ApiOperation({ summary: "List campaigns" })
  async list(@CurrentTenantId() tenantId: string, @Query() query: CampaignQueryDto) {
    return this.campaignService.findAll(tenantId, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get campaign by ID" })
  async get(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.campaignService.findOne(tenantId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update campaign" })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignService.update(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete campaign" })
  @ApiResponse({ status: 204 })
  async remove(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    await this.campaignService.remove(tenantId, id);
  }
}
