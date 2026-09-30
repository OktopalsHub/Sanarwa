import { Injectable } from "@nestjs/common";
import { ConfigurationScope } from "../entities/configuration.entity";

@Injectable()
export class ConfigurationCacheService {
  async invalidate(
    _key: string,
    _scope: ConfigurationScope,
    _scopeId?: string,
    _environment?: string,
  ): Promise<void> {}

  async clear(): Promise<void> {}

  async getStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    return { totalKeys: 0, memoryUsage: "0B" };
  }

  async healthCheck(): Promise<{ status: string }> {
    return { status: "healthy" };
  }
}
