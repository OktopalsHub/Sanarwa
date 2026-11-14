import { describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import { DefaultProjectListener } from "../default-project.listener";

function setup(createProject: ReturnType<typeof vi.fn>) {
  return new DefaultProjectListener({ createProject } as never);
}

const event = { tenant: { id: "t1" } } as never;

describe("DefaultProjectListener", () => {
  it("creates a Default project for the new tenant", async () => {
    const createProject = vi.fn().mockResolvedValue({ id: "p1" });

    await setup(createProject).handleTenantCreated(event);

    expect(createProject).toHaveBeenCalledWith("t1", expect.objectContaining({ name: "Default" }));
  });

  it("does nothing when the project already exists", async () => {
    const createProject = vi.fn().mockRejectedValue(new ConflictException("exists"));

    await expect(setup(createProject).handleTenantCreated(event)).resolves.toBeUndefined();
  });

  it("never lets a failure break tenant creation", async () => {
    const createProject = vi.fn().mockRejectedValue(new Error("db down"));

    await expect(setup(createProject).handleTenantCreated(event)).resolves.toBeUndefined();
  });
});
