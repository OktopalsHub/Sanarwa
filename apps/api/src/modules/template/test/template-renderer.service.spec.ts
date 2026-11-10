import { Test, TestingModule } from "@nestjs/testing";
import { NotificationChannel as TemplateChannel } from "../../../common/enums/notification-channel.enum";
import { TemplateFactory } from "../../../test/factories/template.factory";
import { TemplateRendererService } from "../services/template-renderer.service";
import { TemplateValidatorService } from "../services/template-validator.service";

describe("TemplateRendererService", () => {
  let service: TemplateRendererService;
  let validatorService: TemplateValidatorService;

  const mockValidatorService = {
    validateTemplate: vi.fn(),
    validateVariables: vi.fn(),
    validateTemplateData: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateRendererService,
        {
          provide: TemplateValidatorService,
          useValue: mockValidatorService,
        },
      ],
    }).compile();

    service = module.get<TemplateRendererService>(TemplateRendererService);
    validatorService = module.get<TemplateValidatorService>(TemplateValidatorService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("renderTemplate", () => {
    it("should render email template with variables", async () => {
      const template = TemplateFactory.create({
        channel: TemplateChannel.EMAIL,
        subject: "Welcome {{name}}!",

        data: "Hello {{name}}, welcome to {{company}}!",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
          {
            name: "company",
            type: "string",
            required: true,
            description: "Company name",
          },
        ],
      });

      const data = {
        name: "John Doe",
        company: "Test Company",
      };

      mockValidatorService.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockValidatorService.validateTemplateData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await service.renderTemplate(template, data);

      expect(result.subject).toBe("Welcome John Doe!");
      expect(result.data).toBe("Hello John Doe, welcome to Test Company!");
      expect(mockValidatorService.validateTemplateData).toHaveBeenCalledWith(
        template.variables,
        data,
      );
    });

    it("should render SMS template without subject", async () => {
      const template = TemplateFactory.create({
        channel: TemplateChannel.SMS,
        subject: null,

        data: "Hi {{name}}, your code is {{code}}",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
          {
            name: "code",
            type: "string",
            required: true,
            description: "Verification code",
          },
        ],
      });

      const data = {
        name: "Jane",
        code: "123456",
      };

      mockValidatorService.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockValidatorService.validateTemplateData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await service.renderTemplate(template, data);

      expect(result.subject).toBeUndefined();
      expect(result.data).toBe("Hi Jane, your code is 123456");
      expect(result.subject).toBeUndefined();
    });

    it("should handle missing optional variables", async () => {
      const template = TemplateFactory.create({
        channel: TemplateChannel.EMAIL,
        subject: "Hello {{name}}",

        data: "Welcome {{name}}! {{#if company}}You work at {{company}}.{{/if}}",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
          {
            name: "company",
            type: "string",
            required: false,
            description: "Company name",
          },
        ],
      });

      const data = {
        name: "John Doe",
      };

      mockValidatorService.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockValidatorService.validateTemplateData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await service.renderTemplate(template, data);

      expect(result.subject).toBe("Hello John Doe");
      expect(result.data).toBe("Welcome John Doe! ");
    });

    it("should throw when handlebars syntax is invalid", async () => {
      const template = TemplateFactory.create({
        data: "Invalid template {{unclosed",
      });

      await expect(service.renderTemplate(template, {})).rejects.toThrow(
        "Required variable 'name' is missing",
      );
    });

    it("should throw when variable validation fails", async () => {
      const template = TemplateFactory.create({
        data: "Hello {{name}}!",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
        ],
      });

      const data = {};

      mockValidatorService.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockValidatorService.validateTemplateData.mockReturnValue({
        isValid: false,
        errors: ['Required variable "name" is missing'],
      });

      await expect(service.renderTemplate(template, data)).rejects.toThrow(
        'Template data validation failed: Required variable "name" is missing',
      );
    });

    it("should handle handlebars helpers", async () => {
      const template = TemplateFactory.create({
        channel: TemplateChannel.EMAIL,
        subject: "Order #{{orderNumber}}",

        data: "Total: {{amount}} - Date: {{formatDate date}}",
        variables: [
          {
            name: "orderNumber",
            type: "string",
            required: true,
            description: "Order number",
          },
          {
            name: "amount",
            type: "number",
            required: true,
            description: "Amount",
          },
          { name: "date", type: "string", required: true, description: "Date" },
        ],
      });

      const data = {
        orderNumber: "12345",
        amount: 99.99,
        date: "2024-01-15T10:30:00Z",
      };

      mockValidatorService.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockValidatorService.validateTemplateData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await service.renderTemplate(template, data);

      expect(result.subject).toBe("Order #12345");
      expect(result.data).toContain("99.99");
      expect(result.data).toContain("1/15/2024");
    });

    it("should handle conditional blocks", async () => {
      const template = TemplateFactory.create({
        data: "Hello {{name}}!{{#if isPremium}} You are a premium member.{{/if}}{{#unless isPremium}} Upgrade to premium!{{/unless}}",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "User name",
          },
          {
            name: "isPremium",
            type: "boolean",
            required: false,
            description: "Premium status",
          },
        ],
      });

      mockValidatorService.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockValidatorService.validateTemplateData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const premiumData = { name: "John", isPremium: true };
      const premiumResult = await service.renderTemplate(template, premiumData);
      expect(premiumResult.data).toBe("Hello John! You are a premium member.");

      const regularData = { name: "Jane", isPremium: false };
      const regularResult = await service.renderTemplate(template, regularData);
      expect(regularResult.data).toBe("Hello Jane! Upgrade to premium!");
    });

    it("should handle loops", async () => {
      const template = TemplateFactory.create({
        data: "Items:{{#each items}} - {{name}} (${{price}}){{/each}}",
        variables: [
          {
            name: "items",
            type: "array",
            required: true,
            description: "List of items",
          },
        ],
      });

      const data = {
        items: [
          { name: "Item 1", price: 10.99 },
          { name: "Item 2", price: 15.5 },
        ],
      };

      mockValidatorService.validateTemplate.mockResolvedValue({
        isValid: true,
        errors: [],
      });
      mockValidatorService.validateTemplateData.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const result = await service.renderTemplate(template, data);

      expect(result.data).toBe("Items: - Item 1 ($10.99) - Item 2 ($15.5)");
    });
  });

  describe("validateTemplateSyntax", () => {
    it("should accept a well-formed template", async () => {
      const result = await service.validateTemplateSyntax("Hello {{name}}!");

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject an unclosed handlebars expression", async () => {
      const result = await service.validateTemplateSyntax("Invalid {{unclosed");

      expect(result.isValid).toBe(false);
      expect(result.errors.join(" ")).toContain("Content syntax error");
    });

    it("should validate the subject line too", async () => {
      const result = await service.validateTemplateSyntax("Hello", "Bad {{unclosed");

      expect(result.isValid).toBe(false);
      expect(result.errors.join(" ")).toContain("Subject syntax error");
    });
  });
});
