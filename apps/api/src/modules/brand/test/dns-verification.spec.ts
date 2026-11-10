import { describe, expect, it, vi } from "vitest";

import { DnsVerificationService } from "../services/dns-verification.service";

function service() {
  return new DnsVerificationService();
}

describe("domain verification token", () => {
  it("issues the sanarwa token", () => {
    expect(service().generateVerificationToken("example.com", "brand-1")).toMatch(
      /^sanarwa-verify=[0-9a-f]{32}$/,
    );
  });

  it("accepts a record carrying the current token", async () => {
    const dns = service();
    const token = dns.generateVerificationToken("example.com", "brand-1");

    vi.spyOn(
      dns as never as { resolveTxt: (d: string) => Promise<string[][]> },
      "resolveTxt",
    ).mockResolvedValue([[token]]);

    const result = await dns.verifyDomainOwnership("example.com", token);
    expect(result.verified).toBe(true);
  });

  it("rejects an unrelated record", async () => {
    const dns = service();
    const token = dns.generateVerificationToken("example.com", "brand-1");

    vi.spyOn(
      dns as never as { resolveTxt: (d: string) => Promise<string[][]> },
      "resolveTxt",
    ).mockResolvedValue([["some-other-value"]]);

    const result = await dns.verifyDomainOwnership("example.com", token);
    expect(result.verified).toBe(false);
  });
});
