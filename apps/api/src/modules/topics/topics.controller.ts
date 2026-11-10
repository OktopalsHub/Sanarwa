import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { CurrentTenantId } from "../../common/decorators";
import { TenantMemberGuard } from "../../common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { TopicsService } from "./topics.service";

export class TopicSubscriptionDto {
  @IsString()
  topic: string;

  @IsString()
  subscriberId: string;
}

@ApiTags("Topics")
@ApiBearerAuth()
@Controller("topics")
@UseGuards(AuthGuard, TenantMemberGuard)
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Post("subscribe")
  @ApiOperation({ summary: "Subscribe a subscriber to a topic (broadcast fan-out)" })
  @ApiResponse({ status: 201, description: "Subscribed" })
  subscribe(@CurrentTenantId() tenantId: string, @Body() dto: TopicSubscriptionDto) {
    return this.topicsService.subscribe(tenantId, dto.topic, dto.subscriberId);
  }

  @Post("unsubscribe")
  @ApiOperation({ summary: "Unsubscribe a subscriber from a topic" })
  @ApiResponse({ status: 201, description: "Unsubscribed" })
  unsubscribe(@CurrentTenantId() tenantId: string, @Body() dto: TopicSubscriptionDto) {
    return this.topicsService.unsubscribe(tenantId, dto.topic, dto.subscriberId);
  }

  @Get(":name/members")
  @ApiOperation({ summary: "List a topic's subscribers" })
  @ApiResponse({ status: 200, description: "Subscriber ids" })
  members(@CurrentTenantId() tenantId: string, @Param("name") name: string) {
    return this.topicsService.listSubscribers(tenantId, name);
  }
}
