import { describe, expect, it } from "vitest";
import {
  isPiiKey,
  objectLooksLikeRecipient,
  redactPiiInValue,
  redactRecipient,
  recipientMatches,
} from "../services/pii-redaction";

const SUB = "user-123";
const ADDR = "ada@halo.ng";

describe("pii-redaction", () => {
  describe("isPiiKey", () => {
    it("flags the recipient keys we store on messages", () => {
      for (const key of [
        "to",
        "email",
        "phone",
        "deviceToken",
        "whatsappNumber",
        "userId",
        "subscriberId",
        "id",
        "slackWebhookUrl",
        "chatAddress",
      ]) {
        expect(isPiiKey(key)).toBe(true);
      }
    });

    it("does not flag content fields", () => {
      for (const key of ["subject", "content", "body", "channel", "templateId"]) {
        expect(isPiiKey(key)).toBe(false);
      }
    });
  });

  describe("recipientMatches", () => {
    const base = { id: "other", email: "other@example.com" };

    it("matches by subscriber id or address", () => {
      expect(recipientMatches({ ...base, id: SUB } as any, SUB, ADDR)).toBe(true);
      expect(recipientMatches({ ...base, email: ADDR } as any, SUB, ADDR)).toBe(true);
      expect(
        recipientMatches({ ...base, phone: "+2348012345678" } as any, SUB, "+2348012345678"),
      ).toBe(true);
      expect(recipientMatches({ ...base, email: "ADA@HALO.NG" } as any, SUB, ADDR)).toBe(true);
    });

    it("does not match unrelated records", () => {
      expect(recipientMatches(base as any, SUB, ADDR)).toBe(false);
      expect(recipientMatches({ id: "other", email: "not-it@halo.ng" } as any, SUB, ADDR)).toBe(
        false,
      );
    });
  });

  describe("redactRecipient", () => {
    it("replaces identity fields and leaves non-PII fields alone", () => {
      const out = redactRecipient({
        id: SUB,
        email: ADDR,
        phone: "+2348012345678",
        userId: SUB,
        name: "Ada",
        metadata: { tier: "gold" },
      } as any);
      expect(out.id).toBe("[redacted]");
      expect(out.email).toBe("[redacted]");
      expect(out.phone).toBe("[redacted]");
      expect(out.userId).toBe("[redacted]");
      expect(out.name).toBe("Ada");
      expect(out.metadata).toEqual({ redacted: true });
    });

    it("leaves unset fields unset", () => {
      const out = redactRecipient({ id: SUB } as any);
      expect(out.email).toBeUndefined();
      expect(out.phone).toBeUndefined();
      expect(out.deviceToken).toBeUndefined();
    });
  });

  describe("redactPiiInValue", () => {
    it("redacts a bare subscriber id and a matching address", () => {
      expect(redactPiiInValue(SUB, SUB, ADDR)).toEqual({ value: "[redacted]", changed: true });
      expect(redactPiiInValue(ADDR, SUB, ADDR)).toEqual({ value: "[redacted]", changed: true });
      expect(redactPiiInValue("ADA@HALO.NG" as any, SUB, ADDR)).toEqual({
        value: "[redacted]",
        changed: true,
      });
    });

    it("leaves non-matching values alone", () => {
      expect(redactPiiInValue("keep-me", SUB, ADDR)).toEqual({ value: "keep-me", changed: false });
      expect(redactPiiInValue(42 as any, SUB, ADDR)).toEqual({ value: 42, changed: false });
      expect(redactPiiInValue(null, SUB, ADDR)).toEqual({ value: null, changed: false });
      expect(redactPiiInValue(undefined, SUB, ADDR)).toEqual({ value: undefined, changed: false });
    });

    it("redacts nested recipient objects", () => {
      const input = {
        to: ADDR,
        metadata: {
          note: `reach ${SUB} soon`,
          tags: [`id:${SUB}`, "other"],
        },
      };
      const out = redactPiiInValue(input, SUB, ADDR);
      expect(out.changed).toBe(true);
      expect(out.value).toEqual({
        to: "[redacted]",
        metadata: { note: "reach user-123 soon", tags: ["id:user-123", "other"] },
      });
    });

    it("redacts recipient-shaped objects inside arrays", () => {
      const input = [
        { id: SUB, email: ADDR, name: "A" },
        { id: "other", email: "other@x.com", name: "B" },
        "user-123 pinged",
      ];
      const out = redactPiiInValue(input, SUB, ADDR);
      expect(out.changed).toBe(true);
      expect(out.value[0]).toMatchObject({ id: "[redacted]", email: "[redacted]" });
      expect(out.value[1]).toEqual({ id: "other", email: "other@x.com", name: "B" });
      expect(out.value[2]).toBe("user-123 pinged"); // free text is NOT redacted
    });

    it("redacts the recipients key specifically", () => {
      const input = { recipients: [{ id: SUB, phone: "+2348012345678" }] };
      const out = redactPiiInValue(input, SUB, "+2348012345678");
      expect(out.changed).toBe(true);
      expect(out.value.recipients[0]).toMatchObject({ id: "[redacted]", phone: "[redacted]" });
    });

    it("is idempotent when nothing matches", () => {
      const input = { note: "nothing to see", count: 3 };
      expect(redactPiiInValue(input, SUB, ADDR)).toEqual({ value: input, changed: false });
    });
  });

  describe("objectLooksLikeRecipient", () => {
    it("is the same relation as recipientMatches", () => {
      const r = { id: SUB, email: ADDR } as any;
      expect(objectLooksLikeRecipient(r, SUB, ADDR)).toBe(true);
      expect(objectLooksLikeRecipient({ id: "x" } as any, SUB, ADDR)).toBe(false);
    });
  });
});
