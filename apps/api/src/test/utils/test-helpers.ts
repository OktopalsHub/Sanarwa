import { TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Mocked } from "vitest";
import { Repository } from "typeorm";

/**
 * Creates a mock repository with common methods
 */
export function createMockRepository<T extends Record<string, any> = any>(): Partial<
  Repository<T>
> {
  return {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    remove: vi.fn(),
    count: vi.fn(),
    createQueryBuilder: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
      getMany: vi.fn(),
      getManyAndCount: vi.fn(),
      getRawOne: vi.fn(),
      getRawMany: vi.fn(),
      execute: vi.fn(),
    } as any),
  };
}

/**
 * Gets a mock repository from a testing module
 */
export function getMockRepository<T extends Record<string, any>>(
  module: TestingModule,
  entity: new () => T,
): Mocked<Repository<T>> {
  return module.get(getRepositoryToken(entity));
}

/**
 * Creates a mock ConfigService with default values
 */
export function createMockConfigService(config: Record<string, any> = {}) {
  return {
    get: vi.fn((key: string, defaultValue?: any) => {
      return config[key] ?? defaultValue;
    }),
    getOrThrow: vi.fn((key: string) => {
      const value = config[key];
      if (value === undefined) {
        throw new Error(`Configuration key "${key}" not found`);
      }
      return value;
    }),
  };
}

/**
 * Creates a mock Logger
 */
export function createMockLogger() {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  };
}

/**
 * Creates a mock Redis client
 */
export function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    keys: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    hget: vi.fn(),
    hset: vi.fn(),
    hdel: vi.fn(),
    hgetall: vi.fn(),
    lpush: vi.fn(),
    rpush: vi.fn(),
    lpop: vi.fn(),
    rpop: vi.fn(),
    llen: vi.fn(),
    pipeline: vi.fn(() => ({
      get: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    })),
  };
}

/**
 * Creates a mock HTTP response object
 */
export function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Creates a mock HTTP request object
 */
export function createMockRequest(overrides: any = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    tenant: null,
    ...overrides,
  };
}

/**
 * Waits for a specified amount of time (useful for async testing)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock execution context for guards and interceptors
 */
export function createMockExecutionContext(request: any = {}, response: any = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ...createMockRequest(), ...request }),
      getResponse: () => ({ ...createMockResponse(), ...response }),
    }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  };
}

/**
 * Creates a mock JWT payload
 */
export function createMockJwtPayload(overrides: any = {}) {
  return {
    sub: "user-123",
    email: "test@example.com",
    tenantId: "tenant-123",
    roles: ["user"],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

/**
 * Creates a mock provider response
 */
export function createMockProviderResponse(overrides: any = {}) {
  return {
    messageId: "mock-message-" + Math.random().toString(36).substring(2, 11),
    status: "sent",
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Creates a mock notification payload
 */
export function createMockNotificationPayload(overrides: any = {}) {
  return {
    to: "test@example.com",
    subject: "Test Subject",
    content: "Test Content",
    channel: "email",
    ...overrides,
  };
}

/**
 * Asserts that a function throws an error with a specific message
 */
export async function expectToThrow(
  fn: () => Promise<any> | any,
  expectedMessage?: string | RegExp,
): Promise<Error> {
  try {
    await fn();
    throw new Error("Expected function to throw, but it did not");
  } catch (error) {
    if (expectedMessage) {
      if (typeof expectedMessage === "string") {
        expect(error.message).toContain(expectedMessage);
      } else {
        expect(error.message).toMatch(expectedMessage);
      }
    }
    return error;
  }
}

/**
 * Creates a mock Bull job
 */
export function createMockBullJob(data: any = {}, opts: any = {}) {
  return {
    id: "job-" + Math.random().toString(36).substring(2, 11),
    data,
    opts,
    progress: vi.fn(),
    log: vi.fn(),
    moveToCompleted: vi.fn(),
    moveToFailed: vi.fn(),
    retry: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  };
}

/**
 * Creates a mock Bull queue
 */
export function createMockBullQueue() {
  return {
    add: vi.fn(),
    process: vi.fn(),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    getJobCounts: vi.fn(),
    clean: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

/**
 * Validates that an object matches a partial structure
 */
export function expectObjectToMatch(actual: any, expected: any) {
  Object.keys(expected).forEach((key) => {
    if (typeof expected[key] === "object" && expected[key] !== null) {
      expect(actual[key]).toBeDefined();
      expectObjectToMatch(actual[key], expected[key]);
    } else {
      expect(actual[key]).toEqual(expected[key]);
    }
  });
}

/**
 * Creates a date that is X days from now
 */
export function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Creates a date that is X hours from now
 */
export function hoursFromNow(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

/**
 * Resets all mocks in an object
 */
export function resetMocks(mockObject: any) {
  Object.keys(mockObject).forEach((key) => {
    if (vi.isMockFunction(mockObject[key])) {
      mockObject[key].mockReset();
    }
  });
}
