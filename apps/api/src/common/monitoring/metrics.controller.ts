import {
  Controller,
  Get,
  Header,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "src/modules/auth/decorators/public.decorator";
import { MetricsService } from "./metrics.service";

@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Public()
  @SkipThrottle()
  @Header("Content-Type", "text/plain")
  async getMetrics(@Headers("x-metrics-token") metricsToken?: string): Promise<string> {
    const expected = this.configService.get<string>("METRICS_TOKEN");
    const nodeEnv = this.configService.get<string>("NODE_ENV") || "development";

    if (!expected) {
      if (nodeEnv === "production") {
        throw new NotFoundException();
      }
      return this.metricsService.getMetrics();
    }

    if (!metricsToken || metricsToken !== expected) {
      throw new UnauthorizedException("Invalid metrics token");
    }

    return this.metricsService.getMetrics();
  }
}
