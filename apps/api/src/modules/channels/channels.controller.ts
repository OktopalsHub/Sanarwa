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
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentMemberId, CurrentTenantId } from "../../common/decorators";
import { TenantMemberGuard } from "../../common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChannelsService } from "./channels.service";
import { ConnectChannelDto, TestChannelDto } from "./dto/connect-channel.dto";

@ApiTags("channels")
@ApiBearerAuth()
@Controller("tenants/:tenantId/channels")
@UseGuards(AuthGuard, TenantMemberGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @ApiOperation({ summary: "List the chat channels available to this tenant" })
  @ApiResponse({ status: 200, description: "Channels and their connection state" })
  list(@CurrentTenantId() tenantId: string) {
    return this.channelsService.list(tenantId);
  }

  @Put(":providerId")
  @ApiOperation({ summary: "Connect or update a channel with tenant-owned credentials" })
  @ApiParam({
    name: "providerId",
    enum: ["slack", "discord", "telegram", "whatsapp"],
  })
  @ApiResponse({ status: 200, description: "Channel connected" })
  @ApiResponse({ status: 400, description: "Invalid credentials" })
  upsert(
    @CurrentTenantId() tenantId: string,
    @CurrentMemberId() memberId: string,
    @Param("providerId") providerId: string,
    @Body() dto: ConnectChannelDto,
  ) {
    return this.channelsService.upsert(tenantId, memberId, providerId, dto);
  }

  @Post(":providerId/test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a test message through the tenant's connection" })
  @ApiResponse({ status: 200, description: "Test result" })
  @ApiResponse({ status: 400, description: "Missing destination or invalid credentials" })
  test(
    @CurrentTenantId() tenantId: string,
    @Param("providerId") providerId: string,
    @Body() dto: TestChannelDto,
  ) {
    return this.channelsService.test(tenantId, providerId, dto);
  }

  @Delete(":providerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disconnect a channel and delete its credentials" })
  @ApiResponse({ status: 204, description: "Channel disconnected" })
  disconnect(@CurrentTenantId() tenantId: string, @Param("providerId") providerId: string) {
    return this.channelsService.remove(tenantId, providerId);
  }
}
