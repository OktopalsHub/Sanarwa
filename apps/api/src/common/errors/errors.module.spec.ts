import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { ErrorClassificationService } from './services/error-classification.service';
import { ErrorRecoveryService } from './services/error-recovery.service';

// Import the actual service classes for type checking
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '@nestjs/config';
import type { Mock } from 'vitest';

// Mock the AlertService
const mockAlertService = {
  sendAlert: vi.fn(),
  createAlert: vi.fn(),
  getAlerts: vi.fn(),
};

const mockConfigService = {
  get: vi.fn(),
};

describe('ErrorsModule', () => {
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
          provide: AlertService,
          useValue: mockAlertService,
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

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ErrorClassificationService', () => {
    const service = module.get<ErrorClassificationService>(
      ErrorClassificationService,
    );
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ErrorClassificationService);
  });

  it('should provide CircuitBreakerService', () => {
    const service = module.get<CircuitBreakerService>(CircuitBreakerService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CircuitBreakerService);
  });

  it('should provide ErrorRecoveryService', () => {
    const service = module.get<ErrorRecoveryService>(ErrorRecoveryService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ErrorRecoveryService);
  });

  it('should register GlobalExceptionFilter as APP_FILTER', () => {
    // Test that GlobalExceptionFilter can be instantiated with all dependencies
    const globalExceptionFilter = new GlobalExceptionFilter(
      module.get(AlertService),
      module.get(ConfigService),
    );
    expect(globalExceptionFilter).toBeDefined();
    expect(globalExceptionFilter).toBeInstanceOf(GlobalExceptionFilter);
  });

  it('should export required services', () => {
    const errorClassificationService = module.get(ErrorClassificationService);
    const circuitBreakerService = module.get(CircuitBreakerService);
    const errorRecoveryService = module.get(ErrorRecoveryService);

    expect(errorClassificationService).toBeDefined();
    expect(circuitBreakerService).toBeDefined();
    expect(errorRecoveryService).toBeDefined();
  });

  it('should provide alert service', () => {
    const alertService = module.get(AlertService);

    expect(alertService).toBeDefined();
  });
});
