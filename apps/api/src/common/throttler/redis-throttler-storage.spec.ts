import type Redis from "ioredis";
import { RedisThrottlerStorage } from "./redis-throttler-storage";

const createRedis = () =>
  ({
    get: vi.fn(),
    pttl: vi.fn(),
    eval: vi.fn(),
    set: vi.fn(),
  }) as unknown as Redis & {
    get: ReturnType<typeof vi.fn>;
    pttl: ReturnType<typeof vi.fn>;
    eval: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

describe("RedisThrottlerStorage", () => {
  it("counts the first hit under the limit", async () => {
    const redis = createRedis();
    redis.get.mockResolvedValue(null);
    redis.eval.mockResolvedValue(1);
    redis.pttl.mockResolvedValue(60_000);

    const record = await new RedisThrottlerStorage(redis).increment(
      "k",
      60_000,
      100,
      60_000,
      "default",
    );

    expect(record).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("blocks and arms the block key once the limit is exceeded", async () => {
    const redis = createRedis();
    redis.get.mockResolvedValue(null);
    redis.eval.mockResolvedValue(101);
    redis.pttl.mockResolvedValue(60_000);
    redis.set.mockResolvedValue("OK");

    const record = await new RedisThrottlerStorage(redis).increment(
      "k",
      60_000,
      100,
      120_000,
      "default",
    );

    expect(redis.set).toHaveBeenCalledWith("throttler:k:block:default", "1", "PX", 120_000);
    expect(record).toMatchObject({
      isBlocked: true,
      totalHits: 101,
      timeToBlockExpire: 120,
    });
  });

  it("rejects without touching the window while a block is active", async () => {
    const redis = createRedis();
    redis.get.mockResolvedValue("1");
    redis.pttl.mockResolvedValue(30_000);

    const record = await new RedisThrottlerStorage(redis).increment(
      "k",
      60_000,
      100,
      60_000,
      "default",
    );

    expect(redis.eval).not.toHaveBeenCalled();
    expect(record).toMatchObject({ isBlocked: true, timeToBlockExpire: 30 });
  });

  it("fails open when Redis is unavailable", async () => {
    const redis = createRedis();
    redis.get.mockRejectedValue(new Error("connection refused"));

    const record = await new RedisThrottlerStorage(redis).increment(
      "k",
      60_000,
      100,
      60_000,
      "default",
    );

    expect(record.isBlocked).toBe(false);
    expect(record.totalHits).toBe(1);
  });
});
