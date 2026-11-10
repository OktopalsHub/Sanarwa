import { TopicsService } from "../topics.service";

describe("TopicsService", () => {
  let topics: Record<string, any>;
  let subscriptions: Record<string, any>;
  let service: TopicsService;

  const topic = {
    id: "topic-1",
    tenantId: "tenant-1",
    name: "alerts",
    createdAt: new Date(),
  };

  beforeEach(() => {
    topics = {
      findOne: vi.fn(async () => topic),
      save: vi.fn(async (entity: any) => ({ id: "topic-1", ...entity })),
      create: vi.fn((entity: any) => entity),
    };
    subscriptions = {
      findOne: vi.fn(async () => null),
      find: vi.fn(async () => [
        { id: "s1", topicId: "topic-1", subscriberId: "user-1" },
        { id: "s2", topicId: "topic-1", subscriberId: "user-2" },
      ]),
      save: vi.fn(async (entity: any) => entity),
      create: vi.fn((entity: any) => entity),
      delete: vi.fn(async () => ({ affected: 1 })),
    };
    service = new TopicsService(topics as any, subscriptions as any);
  });

  it("creates a topic on first subscribe and is idempotent afterwards", async () => {
    topics.findOne.mockResolvedValueOnce(null);
    const first = await service.subscribe("tenant-1", "alerts", "user-1");
    expect(topics.save).toHaveBeenCalledTimes(1);
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(first).toBeDefined();

    subscriptions.findOne.mockResolvedValue({
      id: "s1",
      topicId: "topic-1",
      subscriberId: "user-1",
    });
    const second = await service.subscribe("tenant-1", "alerts", "user-1");
    expect(subscriptions.save).toHaveBeenCalledTimes(1);
    expect(second).toBeDefined();
  });

  it("lists subscribers for fan-out", async () => {
    await expect(service.listSubscribers("tenant-1", "alerts")).resolves.toEqual([
      "user-1",
      "user-2",
    ]);
  });

  it("returns an empty list for unknown topics", async () => {
    topics.findOne.mockResolvedValue(null);
    await expect(service.listSubscribers("tenant-1", "missing")).resolves.toEqual([]);
  });

  it("unsubscribes and reports the affected count", async () => {
    await expect(service.unsubscribe("tenant-1", "alerts", "user-1")).resolves.toBe(1);
    expect(subscriptions.delete).toHaveBeenCalledWith({
      topicId: "topic-1",
      subscriberId: "user-1",
    });
  });
});
