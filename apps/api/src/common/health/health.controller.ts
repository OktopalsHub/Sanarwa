import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import type Redis from "ioredis";
import { DataSource } from "typeorm";
import { Public } from "../../modules/auth/decorators/public.decorator";

const CHECK_TIMEOUT_MS = 2000;

type CheckStatus = "up" | "down";

async function check(probe: () => Promise<unknown>): Promise<CheckStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), CHECK_TIMEOUT_MS);
  });

  try {
    await Promise.race([probe(), timeout]);
    return "up";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

@Controller()
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get("health")
  async health(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([
      check(() => this.dataSource.query("SELECT 1")),
      check(() => this.redis.ping()),
    ]);
    const healthy = database === "up" && redis === "up";

    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return { status: healthy ? "ok" : "unavailable", checks: { database, redis } };
  }
}
