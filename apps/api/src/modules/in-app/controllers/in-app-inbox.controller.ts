import { Body, Controller, Get, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentTenantId } from "../../../common/decorators";
import { TenantMemberGuard } from "../../../common/guards";
import { AuthGuard } from "../../auth/guards/jwt-auth.guard";
import { InAppFeedService } from "../services/in-app-feed.service";

@ApiTags("In-App Inbox")
@ApiBearerAuth()
@UseGuards(AuthGuard, TenantMemberGuard)
@Controller("tenants/:tenantId/in-app")
export class InAppInboxController {
  constructor(private readonly feedService: InAppFeedService) {}

  @Get("feed")
  @ApiOperation({ summary: "Get in-app feed (Novu-style) - cursor paginated" })
  async getFeed(
    @CurrentTenantId() tenantId: string,
    @Query("subscriberId") subscriberId: string,
    @Query("feedId") feedId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("seen") seen?: string,
    @Query("read") read?: string,
  ) {
    return this.feedService.getFeed({
      tenantId,
      subscriberId,
      feedId: feedId || "default",
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
      seen: seen !== undefined ? seen === "true" : undefined,
      read: read !== undefined ? read === "true" : undefined,
    });
  }

  @Get("unseen-count")
  @ApiOperation({ summary: "Get unseen count for bell" })
  async getUnseenCount(
    @CurrentTenantId() tenantId: string,
    @Query("subscriberId") subscriberId: string,
    @Query("feedId") feedId?: string,
  ) {
    const count = await this.feedService.getUnseenCount(tenantId, subscriberId, feedId || "default");
    return { count };
  }

  @Patch("seen")
  @ApiOperation({ summary: "Mark seen (eyeball) - Novu parity" })
  async markSeen(
    @CurrentTenantId() tenantId: string,
    @Body() body: { subscriberId: string; messageIds?: string[]; feedId?: string },
  ) {
    const n = await this.feedService.markSeen(tenantId, body.subscriberId, body.messageIds, body.feedId);
    return { updated: n };
  }

  @Patch("read")
  @ApiOperation({ summary: "Mark read (click)" })
  async markRead(
    @CurrentTenantId() tenantId: string,
    @Body() body: { subscriberId: string; messageIds: string[] },
  ) {
    const n = await this.feedService.markRead(tenantId, body.subscriberId, body.messageIds);
    return { updated: n };
  }

  @Patch("archived")
  @ApiOperation({ summary: "Archive/unarchive" })
  async markArchived(
    @CurrentTenantId() tenantId: string,
    @Body() body: { subscriberId: string; messageIds: string[]; archived: boolean },
  ) {
    const n = await this.feedService.markArchived(tenantId, body.subscriberId, body.messageIds, body.archived);
    return { updated: n };
  }

  @Post("mark-all-seen")
  async markAllSeen(
    @CurrentTenantId() tenantId: string,
    @Body() body: { subscriberId: string; feedId?: string },
  ) {
    const n = await this.feedService.markAllSeen(tenantId, body.subscriberId, body.feedId);
    return { updated: n };
  }

  @Post("mark-all-read")
  async markAllRead(
    @CurrentTenantId() tenantId: string,
    @Body() body: { subscriberId: string; feedId?: string },
  ) {
    const n = await this.feedService.markAllRead(tenantId, body.subscriberId, body.feedId);
    return { updated: n };
  }
}
