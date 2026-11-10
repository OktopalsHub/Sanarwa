import { Test, TestingModule } from "@nestjs/testing";
import { Template, TemplateVariable } from "../template.entity";
import { TemplateStatus } from "../../../common/enums/template.enum";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { TemplateValidatorService } from "../services/template-validator.service";

describe("TemplateValidatorService", () => {
  let service: TemplateValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemplateValidatorService],
    }).compile();

    service = module.get<TemplateValidatorService>(TemplateValidatorService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("validateTemplate", () => {
    it("should validate a simple template successfully", async () => {
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.EMAIL,
        subject: "Hello {{name}}",

        data: "Welcome {{name}}!",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
          },
        ],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect syntax errors in content", async () => {
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.EMAIL,
        subject: "Hello {{name}}",

        data: "{{#each items}}{{#if}}{{/each}}",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
          },
        ],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes("Content syntax error"))).toBe(true);
    });

    it("should detect undefined variables", async () => {
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.EMAIL,
        subject: "Hello {{name}}",

        data: "Welcome {{name}}! Your email is {{email}}",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
          },
        ],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'email' is used but not defined");
    });

    it("should warn about unused variables", async () => {
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.EMAIL,
        subject: "Hello {{name}}",

        data: "Welcome {{name}}!",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
          },
          {
            name: "email",
            type: "string",
            required: false,
          },
        ],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Variable 'email' is defined but not used");
    });

    it("should validate email-specific requirements", async () => {
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.EMAIL,

        data: "Welcome!",
        variables: [],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Email templates must have a subject");
    });

    it("should validate SMS length warnings", async () => {
      const longContent = "A".repeat(1700);
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.SMS,

        data: longContent,
        variables: [],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "SMS content is longer than 1600 characters and may be split into multiple messages",
      );
    });

    it("should validate WhatsApp media template requirements", async () => {
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.WHATSAPP,

        data: "Check out this image!",
        variables: [],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        channelSpecific: {
          whatsapp: {
            templateType: "media",
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("WhatsApp media templates must specify mediaUrl");
    });

    it("should validate variable constraints", async () => {
      const template: Template = {
        id: "1",
        tenantId: "tenant1",
        name: "Test Template",
        channel: NotificationChannel.EMAIL,
        subject: "Test",

        data: "Welcome {{name}}!",
        variables: [
          {
            name: "name",
            type: "string",
            required: true,
            validation: {
              minLength: 10,
              maxLength: 5,
            },
          },
        ],
        version: 1,
        status: TemplateStatus.DRAFT,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'name' minLength cannot be greater than maxLength");
    });
  });

  describe("validateTemplateData", () => {
    const variables: TemplateVariable[] = [
      {
        name: "name",
        type: "string",
        required: true,
        validation: {
          minLength: 2,
          maxLength: 50,
        },
      },
      {
        name: "age",
        type: "number",
        required: false,
        validation: {
          min: 0,
          max: 120,
        },
      },
      {
        name: "email",
        type: "string",
        required: true,
        validation: {
          pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
        },
      },
    ];

    it("should validate correct data", () => {
      const data = {
        name: "John Doe",
        age: 30,
        email: "john@example.com",
      };

      const result = service.validateTemplateData(variables, data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing required variables", () => {
      const data = {
        age: 30,
      };

      const result = service.validateTemplateData(variables, data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required variable 'name' is missing");
      expect(result.errors).toContain("Required variable 'email' is missing");
    });

    it("should validate string length constraints", () => {
      const data = {
        name: "A",
        email: "john@example.com",
      };

      const result = service.validateTemplateData(variables, data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'name' is too short (minimum 2 characters)");
    });

    it("should validate number range constraints", () => {
      const data = {
        name: "John Doe",
        age: 150,
        email: "john@example.com",
      };

      const result = service.validateTemplateData(variables, data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'age' is too large (maximum 120)");
    });

    it("should validate pattern constraints", () => {
      const data = {
        name: "John Doe",
        email: "invalid-email",
      };

      const result = service.validateTemplateData(variables, data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'email' does not match required pattern");
    });

    it("should validate type constraints", () => {
      const data = {
        name: 123,
        age: "thirty",
        email: "john@example.com",
      };

      const result = service.validateTemplateData(variables, data);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'name' should be string but got number");
      expect(result.errors).toContain("Variable 'age' should be number but got string");
    });
  });
});
