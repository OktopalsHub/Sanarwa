import { describe, expect, it } from "vitest";
import { toAuthProfile } from "./auth-profile";

describe("toAuthProfile", () => {
  it("splits name into firstName/lastName and maps OpenAPI fields", () => {
    const profile = toAuthProfile({
      id: "user-1",
      email: "a@example.com",
      name: "Ada Lovelace",
      image: "https://example.com/a.png",
      emailVerified: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    });

    expect(profile).toMatchObject({
      id: "user-1",
      email: "a@example.com",
      name: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      fullName: "Ada Lovelace",
      avatar: "https://example.com/a.png",
      emailVerified: true,
      status: "active",
      authProvider: "local",
      role: "basic",
    });
  });

  it("defaults firstName when name is empty", () => {
    const profile = toAuthProfile({
      id: "user-2",
      email: "b@example.com",
      name: "",
      image: null,
      emailVerified: false,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    });

    expect(profile.firstName).toBe("User");
    expect(profile.lastName).toBe("");
    expect(profile.avatar).toBeUndefined();
  });
});
