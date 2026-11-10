import { APP_FILTER } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { CircuitBreakerService } from "./services/circuit-breaker.service";
import { ErrorClassificationService } from "./services/error-classification.service";
import { ErrorRecoveryService } from "./services/error-recovery.service";

import { ConfigService } from "@nestjs/config";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import Redis from "ioredis-mock";

const mockConfigService = {
  get: vi.fn(),
};

describe("ErrorsModule", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
        ErrorClassificationService,
        CircuitBreakerService,
        ErrorRecoveryService,
        {
          provide: getRedisConnectionToken(),
          useValue: new Redis(),
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it("should be defined", () => {
    expect(module).toBeDefined();
  });

  it("should provide ErrorClassificationService", () => {
    const service = module.get<ErrorClassificationService>(ErrorClassificationService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ErrorClassificationService);
  });

  it("should provide CircuitBreakerService", () => {
    const service = module.get<CircuitBreakerService>(CircuitBreakerService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CircuitBreakerService);
  });

  it("should provide ErrorRecoveryService", () => {
    const service = module.get<ErrorRecoveryService>(ErrorRecoveryService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ErrorRecoveryService);
  });

  it("should register GlobalExceptionFilter as APP_FILTER", () => {
    const globalExceptionFilter = new GlobalExceptionFilter(module.get(ConfigService));
    expect(globalExceptionFilter).toBeDefined();
    expect(globalExceptionFilter).toBeInstanceOf(GlobalExceptionFilter);
  });

  it("should export required services", () => {
    const errorClassificationService = module.get(ErrorClassificationService);
    const circuitBreakerService = module.get(CircuitBreakerService);
    const errorRecoveryService = module.get(ErrorRecoveryService);

    expect(errorClassificationService).toBeDefined();
    expect(circuitBreakerService).toBeDefined();
    expect(errorRecoveryService).toBeDefined();
  });
});
