import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CampaignQueryDto } from "../dto/campaign-query.dto";

const parse = (query: Record<string, string>) => plainToInstance(CampaignQueryDto, query);

describe("CampaignQueryDto", () => {
  it("accepts numeric query params, which always arrive as strings", async () => {
    const dto = parse({ page: "2", limit: "50", sortBy: "updatedAt", sortOrder: "desc" });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(50);
  });

  it("still caps the page size", async () => {
    const errors = await validate(parse({ limit: "1000" }));

    expect(errors.map((error) => error.property)).toContain("limit");
  });
});
