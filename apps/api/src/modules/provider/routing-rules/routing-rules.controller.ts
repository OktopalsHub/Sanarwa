import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../common/enums";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  ROUTING_CHANNELS,
  RoutingChannel,
  RoutingRuleScopeDto,
  SetRoutingRuleDto,
} from "./routing-rules.dto";
import { RoutingRulesService } from "./routing-rules.service";

enum RoutingChannelParam {
  Email = "email",
  Push = "push",
  Sms = "sms",
}

@ApiTags("Routing Rules")
@Controller("admin/routing-rules")
@Roles(UserRole.SUPER_ADMIN)
export class RoutingRulesController {
  constructor(private readonly rules: RoutingRulesService) {}

  @Get()
  @ApiOperation({ summary: "List managed-provider routing rules" })
  async list() {
    return { channels: ROUTING_CHANNELS, rules: await this.rules.list() };
  }

  @Put(":channel")
  @ApiOperation({ summary: "Set the managed provider order for a channel (and SMS region)" })
  async set(
    @Param("channel", new ParseEnumPipe(RoutingChannelParam)) channel: RoutingChannel,
    @Body() body: SetRoutingRuleDto,
  ) {
    return this.rules.set(channel, body);
  }

  @Delete(":channel")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a routing rule so the default chain applies again" })
  async remove(
    @Param("channel", new ParseEnumPipe(RoutingChannelParam)) channel: RoutingChannel,
    @Query() query: RoutingRuleScopeDto,
  ) {
    await this.rules.remove(channel, query.region);
  }
}
