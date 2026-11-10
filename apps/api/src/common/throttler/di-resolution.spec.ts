import { describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import { RedisModule } from "@nestjs-modules/ioredis";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ConfigurationCacheService } from "../../modules/configuration/services/configuration-cache.service";
import { CircuitBreakerService } from "../errors/services/circuit-breaker.service";
import { ErrorRecoveryService } from "../errors/services/error-recovery.service";
import { SmartSMSRouterService } from "../../modules/provider/services/smart-sms-router.service";
import { DigestService } from "../../modules/messaging/services/digest.service";
import { SchedulingService } from "../../modules/messaging/services/scheduling.service";
import { InAppNotification } from "../../modules/messaging/entities/in-app-notification.entity";
import { LoggingService } from "../monitoring/services/logging.service";

const REDIS_DI_CHECK = process.env.REDIS_DI_CHECK;

describe("Redis DI resolution", () => {
  it.skipIf(!REDIS_DI_CHECK)(
    "resolves every Redis-consuming provider against the real RedisModule",
    async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ isGlobal: true }),
          RedisModule.forRoot({ type: "single", url: REDIS_DI_CHECK }),
          EventEmitterModule.forRoot(),
        ],
        providers: [
          ConfigurationCacheService,
          CircuitBreakerService,
          ErrorRecoveryService,
          DigestService,
          SchedulingService,
          SmartSMSRouterService,
          { provide: LoggingService, useValue: { info: vi.fn(), error: vi.fn() } },
          {
            provide: getRepositoryToken(InAppNotification),
            useValue: { count: vi.fn(), delete: vi.fn() },
          },
        ],
      }).compile();

      expect(moduleRef.get(ConfigurationCacheService)).toBeDefined();
      expect(moduleRef.get(CircuitBreakerService)).toBeDefined();
      expect(moduleRef.get(ErrorRecoveryService)).toBeDefined();
      expect(moduleRef.get(DigestService)).toBeDefined();
      expect(moduleRef.get(SchedulingService)).toBeDefined();
      expect(moduleRef.get(SmartSMSRouterService)).toBeDefined();

      await moduleRef.close();
    },
    30_000,
  );
});
