import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import { ProviderOrchestratorService } from "../provider-orchestrator.service";
import { RoutingChannel, RoutingRuleEntry, ROUTING_CHANNELS } from "./routing-rules.dto";

const KEY_PREFIX = "optimizer:rule";
const GLOBAL_REGION = "global";
const SCAN_BATCH = 100;

@Injectable()
export class RoutingRulesService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly orchestrator: ProviderOrchestratorService,
  ) {}

  async list(): Promise<RoutingRuleEntry[]> {
    const keys = await this.scanKeys();
    if (keys.length === 0) {
      return [];
    }

    const values = await this.redis.mget(keys);
    const entries: RoutingRuleEntry[] = [];

    keys.forEach((key, index) => {
      const entry = parseEntry(key, values[index]);
      if (entry) {
        entries.push(entry);
      }
    });

    return entries.sort((a, b) =>
      `${a.channel}:${a.region}`.localeCompare(`${b.channel}:${b.region}`),
    );
  }

  async set(
    channel: RoutingChannel,
    input: { region?: string; primary: string; fallback: string[] },
  ): Promise<RoutingRuleEntry> {
    const region = this.resolveRegion(channel, input.region);
    const ordered = [input.primary, ...input.fallback];
    const allowed = new Set(this.orchestrator.managedProviderNames(channel));

    const unknown = ordered.filter((name) => !allowed.has(name));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown ${channel} provider(s): ${unknown.join(", ")}. Available: ${[...allowed].join(", ")}`,
      );
    }
    if (new Set(ordered).size !== ordered.length) {
      throw new BadRequestException("A provider can appear only once in a rule");
    }

    await this.redis.set(
      keyFor(channel, region),
      JSON.stringify({ providers: { primary: input.primary, fallback: input.fallback } }),
    );

    return { channel, region, primary: input.primary, fallback: input.fallback };
  }

  async remove(channel: RoutingChannel, regionInput?: string): Promise<void> {
    const region = this.resolveRegion(channel, regionInput);
    const removed = await this.redis.del(keyFor(channel, region));
    if (removed === 0) {
      throw new NotFoundException(`No routing rule for ${channel}:${region}`);
    }
  }

  private resolveRegion(channel: RoutingChannel, region?: string): string {
    if (!region) {
      return GLOBAL_REGION;
    }
    if (channel !== "sms") {
      throw new BadRequestException("Only sms routing rules can be scoped to a region");
    }
    return region;
  }

  private async scanKeys(): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";

    do {
      const [next, batch] = await this.redis.scan(
        cursor,
        "MATCH",
        `${KEY_PREFIX}:*`,
        "COUNT",
        SCAN_BATCH,
      );
      keys.push(...batch);
      cursor = next;
    } while (cursor !== "0");

    return [...new Set(keys)];
  }
}

function keyFor(channel: RoutingChannel, region: string): string {
  return `${KEY_PREFIX}:${channel}:${region}`;
}

function parseEntry(key: string, raw: string | null): RoutingRuleEntry | null {
  const [, , channel, region] = key.split(":");
  if (!raw || !region || !(ROUTING_CHANNELS as readonly string[]).includes(channel ?? "")) {
    return null;
  }

  try {
    const rule = JSON.parse(raw) as { providers?: { primary?: unknown; fallback?: unknown } };
    const { primary, fallback } = rule.providers ?? {};
    if (typeof primary !== "string" || !Array.isArray(fallback)) {
      return null;
    }
    return {
      channel: channel as RoutingChannel,
      region,
      primary,
      fallback: fallback.filter((name): name is string => typeof name === "string"),
    };
  } catch {
    return null;
  }
}
