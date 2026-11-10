import { describe, expect, it, vi } from "vitest";
import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  const buildService = () =>
    new MetricsService({
      get: vi.fn().mockReturnValue(undefined),
    } as never);

  it("serves the same registry that recorders write to", async () => {
    const service = buildService();

    service.recordHttpRequest("GET", "/api/v1/widgets", 200, 120);
    service.setDatabaseConnections(3);

    const registry = service.getRegistry();
    const served = await registry.metrics();

    expect(served).toContain("http_requests_total");
    expect(served).toContain("http_request_duration_seconds");
    expect(served).toContain("database_connections_active 3");
  });

  it("labels the request counter with the route and status", async () => {
    const service = buildService();
    service.recordHttpRequest("POST", "/api/v1/widgets", 201, 15);

    const output = await service.getMetrics();

    expect(output).toContain('method="POST"');
    expect(output).toContain('route="/api/v1/widgets"');
    expect(output).toContain('status="201"');
  });

  it("sets the database connection gauge", async () => {
    const service = buildService();
    service.setDatabaseConnections(7);

    const output = await service.getMetrics();

    expect(output).toContain("database_connections_active 7");
  });

  it("keeps getMetrics and getRegistry consistent", async () => {
    const service = buildService();
    service.incrementUserAction("open", "tenant-1");

    const fromGetMetrics = await service.getMetrics();
    const fromRegistry = await service.getRegistry().metrics();

    expect(fromGetMetrics).toContain("user_actions_total");
    expect(fromRegistry).toContain("user_actions_total");
  });
});
