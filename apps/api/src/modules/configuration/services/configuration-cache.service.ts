import { Injectable } from "@nestjs/common";
import { ConfigurationScope } from "../entities/configuration.entity";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class ConfigurationCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 60_000;

  async get<T>(key: string, scope: ConfigurationScope, scopeId?: string, environment?: string): Promise<T | undefined> {
    const cacheKey = this.buildKey(key, scope, scopeId, environment);
    const entry = this.cache.get(cacheKey);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.value as T;
  }

  async set(
    key: string,
    scope: ConfigurationScope,
    value: unknown,
    scopeId?: string,
    environment?: string,
    ttlMs = this.ttlMs,
  ): Promise<void> {
    this.cache.set(this.buildKey(key, scope, scopeId, environment), {
      value,
      expiresAt: Date.now() + Math.max(1, ttlMs),
    });
  }

  async invalidate(
    key: string,
    scope: ConfigurationScope,
    scopeId?: string,
    environment?: string,
  ): Promise<void> {
    this.cache.delete(this.buildKey(key, scope, scopeId, environment));
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    this.pruneExpired();
    return {
      totalKeys: this.cache.size,
      memoryUsage: `${this.cache.size} entries`,
    };
  }

  async healthCheck(): Promise<{ status: string }> {
    this.pruneExpired();
    return { status: "healthy" };
  }

  private buildKey(
    key: string,
    scope: ConfigurationScope,
    scopeId?: string,
    environment?: string,
  ): string {
    return [scope, scopeId ?? "", environment ?? "", key].join(":");
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
