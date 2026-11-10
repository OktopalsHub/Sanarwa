import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentTenantId } from "../../common/decorators";
import { TenantMemberGuard } from "../../common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { PreferencesService } from "./preferences.service";
import { NotificationPreference } from "./entities/notification-preference.entity";
import {
  CreateSuppressionDto,
  ListSuppressionsQueryDto,
  QuietHoursDto,
  SetPreferencesDto,
} from "./dto/preferences.dto";

@ApiTags("Preferences")
@ApiBearerAuth()
@UseGuards(AuthGuard, TenantMemberGuard)
@Controller("tenants/:tenantId")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get("subscribers/:subscriberId/preferences")
  @ApiOperation({ summary: "Get a subscriber's channel preferences" })
  @ApiResponse({ status: 200, description: "Channel preferences and quiet hours" })
  async getSubscriberPreferences(
    @CurrentTenantId() tenantId: string,
    @Param("subscriberId") subscriberId: string,
  ) {
    return this.preferencesService.getSubscriberPreferences(tenantId, subscriberId);
  }

  @Put("subscribers/:subscriberId/preferences")
  @ApiOperation({ summary: "Update a subscriber's channel preferences (per channel)" })
  @HttpCode(HttpStatus.OK)
  async setPreferences(
    @CurrentTenantId() tenantId: string,
    @Param("subscriberId") subscriberId: string,
    @Body() dto: SetPreferencesDto,
  ) {
    const results: NotificationPreference[] = [];
    for (const preference of dto.preferences) {
      results.push(
        await this.preferencesService.setChannelEnabled(
          tenantId,
          subscriberId,
          preference.channel,
          preference.enabled,
        ),
      );
    }

    return { subscriberId, preferences: results };
  }

  @Get("subscribers/:subscriberId/quiet-hours")
  @ApiOperation({ summary: "Get a subscriber's quiet hours" })
  async getQuietHours(
    @CurrentTenantId() tenantId: string,
    @Param("subscriberId") subscriberId: string,
  ) {
    return this.preferencesService.getQuietHours(tenantId, subscriberId);
  }

  @Put("subscribers/:subscriberId/quiet-hours")
  @ApiOperation({ summary: "Create or replace a subscriber's quiet hours window" })
  async setQuietHours(
    @CurrentTenantId() tenantId: string,
    @Param("subscriberId") subscriberId: string,
    @Body() dto: QuietHoursDto,
  ) {
    return this.preferencesService.setQuietHours(tenantId, subscriberId, dto);
  }

  @Delete("subscribers/:subscriberId/quiet-hours")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disable a subscriber's quiet hours" })
  async deleteQuietHours(
    @CurrentTenantId() tenantId: string,
    @Param("subscriberId") subscriberId: string,
  ): Promise<void> {
    return this.preferencesService.deleteQuietHours(tenantId, subscriberId);
  }

  @Get("suppressions")
  @ApiOperation({ summary: "List suppressed addresses (unsubscribes, bounces, complaints)" })
  async listSuppressions(
    @CurrentTenantId() tenantId: string,
    @Query() query: ListSuppressionsQueryDto,
  ) {
    return this.preferencesService.listSuppressions(tenantId, query);
  }

  @Post("suppressions")
  @ApiOperation({ summary: "Suppress an address (all channels unless specified)" })
  @HttpCode(HttpStatus.CREATED)
  async addSuppression(@CurrentTenantId() tenantId: string, @Body() dto: CreateSuppressionDto) {
    return this.preferencesService.addSuppression(tenantId, dto);
  }

  @Delete("suppressions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a suppression from the list" })
  async removeSuppression(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
  ): Promise<void> {
    return this.preferencesService.removeSuppression(tenantId, id);
  }

  @Delete("subscribers/:subscriberId/data")
  @ApiOperation({ summary: "Erase a subscriber's preference/consent data (GDPR/right-to-erasure)" })
  async eraseSubscriberData(
    @CurrentTenantId() tenantId: string,
    @Param("subscriberId") subscriberId: string,
  ) {
    const deleted = await this.preferencesService.eraseSubscriberData(tenantId, subscriberId);
    return { subscriberId, deleted };
  }
}
