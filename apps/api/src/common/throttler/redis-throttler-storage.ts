import { Logger } from "@nestjs/common";
import type Redis from "ioredis";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";

const HIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const windowKey = `throttler:${key}`;
    const blockKey = `throttler:${key}:block:${throttlerName}`;

    try {
      const blocked = await this.redis.get(blockKey);
      if (blocked) {
        const blockTtl = await this.redis.pttl(blockKey);
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire: Math.max(0, Math.ceil(blockTtl / 1000)),
        };
      }

      const count = (await this.redis.eval(HIT_SCRIPT, 1, windowKey, ttl)) as number;
      const pttl = await this.redis.pttl(windowKey);
      const timeToExpire = Math.max(0, Math.ceil(pttl / 1000));

      if (count > limit) {
        await this.redis.set(blockKey, "1", "PX", blockDuration);
        return {
          totalHits: count,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockDuration / 1000),
        };
      }

      return { totalHits: count, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
    } catch (error) {
      this.logger.warn(
        `Redis throttle storage failed, allowing request: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
