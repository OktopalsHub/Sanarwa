import { Injectable } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import { ConfigurationScope } from "../entities/configuration.entity";

const KEY_PREFIX = "config:";

@Injectable()
export class ConfigurationCacheService {
  private readonly ttlMs = 60_000;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async get<T>(
    key: string,
    scope: ConfigurationScope,
    scopeId?: string,
    environment?: string,
  ): Promise<T | undefined> {
    const cached = await this.redis.get(
      KEY_PREFIX + this.buildKey(key, scope, scopeId, environment),
    );
    return cached === null ? undefined : (JSON.parse(cached) as T);
  }

  async set(
    key: string,
    scope: ConfigurationScope,
    value: unknown,
    scopeId?: string,
    environment?: string,
    ttlMs = this.ttlMs,
  ): Promise<void> {
    await this.redis.set(
      KEY_PREFIX + this.buildKey(key, scope, scopeId, environment),
      JSON.stringify(value),
      "PX",
      Math.max(1, ttlMs),
    );
  }

  async invalidate(
    key: string,
    scope: ConfigurationScope,
    scopeId?: string,
    environment?: string,
  ): Promise<void> {
    await this.redis.del(KEY_PREFIX + this.buildKey(key, scope, scopeId, environment));
  }

  async clear(): Promise<void> {
    const keys = await this.scanKeys(`${KEY_PREFIX}*`);
    if (keys.length > 0) {
      await this.redis.del(keys);
    }
  }

  async getStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    const keys = await this.scanKeys(`${KEY_PREFIX}*`);
    return {
      totalKeys: keys.length,
      memoryUsage: `${keys.length} entries`,
    };
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");
    return keys;
  }

  private buildKey(
    key: string,
    scope: ConfigurationScope,
    scopeId?: string,
    environment?: string,
  ): string {
    return [scope, scopeId ?? "", environment ?? "", key].join(":");
  }
}
