import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentTenantId, CurrentUserId } from "../../../common/decorators";
import { TenantMemberGuard } from "../../../common/guards";
import { AuthGuard } from "../../auth/guards/jwt-auth.guard";
import { DevicePlatform } from "../enums/device-platform.enum";
import { DeviceRegistrationService } from "../services/device-registration.service";
import { SmartPushRouterService } from "../services/smart-push-router.service";

export class RegisterDeviceDto {
  deviceToken: string;
  userAgent?: string;
  appBundleId?: string;
  deviceInfo?: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
    language?: string;
    timezone?: string;
  };
  metadata?: Record<string, any>;
}

export class TestPushDto {
  platforms: DevicePlatform[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

@ApiTags("Device Registration")
@Controller("tenants/:tenantId/devices")
@UseGuards(AuthGuard, TenantMemberGuard)
export class DeviceRegistrationController {
  constructor(
    private readonly deviceRegistrationService: DeviceRegistrationService,
    private readonly smartPushRouter: SmartPushRouterService,
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Register a device for push notifications" })
  @ApiResponse({ status: 201, description: "Device registered successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async registerDevice(
    @CurrentUserId() subscriberId: string,
    @CurrentTenantId() tenantId: string,
    @Body() registerDto: RegisterDeviceDto,
  ) {
    return this.deviceRegistrationService.registerDevice({
      subscriberId,
      tenantId,
      ...registerDto,
    });
  }

  @Get("my-devices")
  @ApiOperation({ summary: "Get current subscriber devices" })
  @ApiResponse({ status: 200, description: "Devices retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getMyDevices(@CurrentUserId() subscriberId: string, @CurrentTenantId() tenantId: string) {
    return this.deviceRegistrationService.getSubscriberDevices(subscriberId, tenantId);
  }

  @Get("stats")
  @ApiOperation({ summary: "Get device statistics for tenant" })
  @ApiResponse({ status: 200, description: "Device statistics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getDeviceStats(@CurrentTenantId() tenantId: string) {
    return this.deviceRegistrationService.getDeviceStats(tenantId);
  }

  @Get("push-recommendations")
  @ApiOperation({ summary: "Get push notification setup recommendations" })
  @ApiResponse({ status: 200, description: "Recommendations retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getPushRecommendations(@CurrentTenantId() tenantId: string) {
    return this.smartPushRouter.getPushRecommendations(tenantId);
  }

  @Post("test-push")
  @ApiOperation({ summary: "Test push notification delivery" })
  @ApiResponse({ status: 201, description: "Test push sent successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async testPushDelivery(
    @CurrentUserId() subscriberId: string,
    @CurrentTenantId() tenantId: string,
    @Body() testDto: TestPushDto,
  ) {
    return this.smartPushRouter.testPushDelivery(tenantId, subscriberId, testDto.platforms, {
      title: testDto.title,
      body: testDto.body,
      data: testDto.data,
    });
  }

  @Delete(":deviceToken")
  @ApiOperation({ summary: "Deactivate a device" })
  @ApiResponse({ status: 200, description: "Device deactivated successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Device not found" })
  async deactivateDevice(
    @CurrentUserId() subscriberId: string,
    @CurrentTenantId() tenantId: string,
    @Param("deviceToken") deviceToken: string,
  ) {
    await this.deviceRegistrationService.deactivateDevice(deviceToken, subscriberId, tenantId);
    return { success: true };
  }

  @Get("platform/:platform")
  @ApiOperation({ summary: "Get devices by platform" })
  @ApiResponse({ status: 200, description: "Devices retrieved successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getDevicesByPlatform(
    @CurrentUserId() subscriberId: string,
    @CurrentTenantId() tenantId: string,
    @Param("platform") platform: DevicePlatform,
  ) {
    return this.deviceRegistrationService.getDevicesByPlatform(subscriberId, tenantId, platform);
  }
}
