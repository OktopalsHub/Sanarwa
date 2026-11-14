import { describe, expect, it, vi } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateProviderConfigDto } from "../dto/create-provider-config.dto";
import { maskSecrets, presentConfig } from "../mask-provider-config";
import { ProviderConfigValidator } from "../provider-config-validator";
import { ProviderConfigController } from "../provider-config.controller";

describe("maskSecrets", () => {
  it("masks secret-looking values and keeps the rest readable", () => {
    const masked = maskSecrets({
      apiKey: "SG.abcdefghijklmnop",
      authToken: "x",
      fromEmail: "ops@example.com",
      region: "us-east-1",
    });

    expect(masked).toEqual({
      apiKey: "••••mnop",
      authToken: "••••",
      fromEmail: "ops@example.com",
      region: "us-east-1",
    });
  });

  it("masks an encrypted blob rather than returning it", () => {
    const masked = maskSecrets({ secretAccessKey: { encryptedData: "abc", iv: "def" } });

    expect(masked.secretAccessKey).toBe("••••");
  });

  it("leaves empty secrets empty so the UI can tell they are unset", () => {
    expect(maskSecrets({ apiKey: "" }).apiKey).toBe("");
  });

  it("does not mutate the stored config", () => {
    const original = { config: { apiKey: "SG.abcdefghijklmnop" } };

    presentConfig(original);

    expect(original.config.apiKey).toBe("SG.abcdefghijklmnop");
  });
});

describe("ProviderConfigValidator.describeSchemas", () => {
  const schemas = new ProviderConfigValidator().describeSchemas();

  it("describes SendGrid's required key and flags it as secret", () => {
    const sendgrid = schemas.find((s) => s.channel === "email" && s.providerId === "sendgrid");

    expect(sendgrid?.required).toEqual(["apiKey"]);
    expect(sendgrid?.secretFields).toContain("apiKey");
    expect(sendgrid?.description.apiKey).toBeTruthy();
  });

  it("does not flag plain fields as secret", () => {
    const sendgrid = schemas.find((s) => s.providerId === "sendgrid");

    expect(sendgrid?.secretFields).not.toContain("fromEmail");
  });
});

describe("ProviderConfigController list", () => {
  it("lists only the project in the URL, with secrets masked", async () => {
    const providerService = {
      findConfigsByProject: vi.fn().mockResolvedValue({
        configs: [{ id: "c1", config: { apiKey: "SG.abcdefghijklmnop" } }],
        total: 1,
      }),
    };
    const controller = new ProviderConfigController(providerService as never, {} as never);

    const result = await controller.findAll("tenant-1", "project-1", {} as never);

    expect(providerService.findConfigsByProject).toHaveBeenCalledWith("tenant-1", "project-1", {});
    expect(result.configs[0]!.config.apiKey).toBe("••••mnop");
  });
});

describe("CreateProviderConfigDto", () => {
  const build = (overrides: Record<string, unknown> = {}) =>
    plainToInstance(CreateProviderConfigDto, {
      providerId: "mailgun",
      providerName: "Mailgun",
      providerType: "mailgun",
      channel: "email",
      config: { apiKey: "key-abcdefghijkl" },
      ...overrides,
    });

  it("accepts any supported provider, not only a fixed enum", async () => {
    expect(await validate(build())).toHaveLength(0);
  });

  it("rejects an unknown channel", async () => {
    const errors = await validate(build({ channel: "pigeon" }));

    expect(errors.map((error) => error.property)).toContain("channel");
  });

  it("rejects a missing config object", async () => {
    const errors = await validate(build({ config: undefined }));

    expect(errors.map((error) => error.property)).toContain("config");
  });
});

describe("ProviderConfigController create", () => {
  const body = {
    providerId: "sendgrid",
    providerName: "SendGrid",
    providerType: "sendgrid",
    channel: "email",
    config: {},
  } as never;

  it("rejects credentials the provider's schema says are incomplete, before saving", async () => {
    const providerService = { createConfig: vi.fn() };
    const controller = new ProviderConfigController(
      providerService as never,
      new ProviderConfigValidator(),
    );

    await expect(controller.create("tenant-1", "project-1", body)).rejects.toThrow(
      /Invalid provider configuration/,
    );

    expect(providerService.createConfig).not.toHaveBeenCalled();
  });

  it("saves valid credentials and returns them masked", async () => {
    const providerService = {
      createConfig: vi
        .fn()
        .mockResolvedValue({ id: "c1", config: { apiKey: "SG.abcdefghijklmnop" } }),
    };
    const controller = new ProviderConfigController(
      providerService as never,
      new ProviderConfigValidator(),
    );

    const created = await controller.create("tenant-1", "project-1", {
      ...(body as object),
      config: { apiKey: "SG.abcdefghijklmnop" },
    } as never);

    expect(providerService.createConfig).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project-1" }),
    );
    expect(created.config.apiKey).toBe("••••mnop");
  });
});
