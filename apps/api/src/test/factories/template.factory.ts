import { TemplateStatus } from "../../common/enums";
import { Template } from "../../modules/template/template.entity";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";

export class TemplateFactory {
  static create(overrides: Partial<Template> = {}): Template {
    const template = new Template();
    template.id = "template-" + Math.random().toString(36).substr(2, 9);
    template.tenantId = "tenant-" + Math.random().toString(36).substr(2, 9);
    template.tenant = {
      id: "tenant-" + Math.random().toString(36).substr(2, 9),
    } as any;
    template.name = "Test Template";
    template.description = "Test template description";

    template.channel = NotificationChannel.EMAIL;
    template.subject = "Hello {{name}}";
    template.data = "Welcome {{name}}, this is a test message.";
    template.variables = [
      {
        name: "name",
        type: "string",
        required: true,
        description: "User name",
      },
    ];
    template.version = 1;
    template.status = TemplateStatus.ACTIVE;
    template.isDefault = false;
    template.metadata = {};
    template.createdBy = {
      id: "member-" + Math.random().toString(36).substr(2, 9),
    } as any;
    template.createdAt = new Date();
    template.updatedAt = new Date();

    Object.assign(template, overrides);
    return template;
  }

  static createMany(count: number, overrides: Partial<Template> = {}): Template[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        ...overrides,
        id: `template-${index + 1}`,
        name: `Test Template ${index + 1}`,
      }),
    );
  }

  static createForChannel(
    channel: NotificationChannel,
    overrides: Partial<Template> = {},
  ): Template {
    const channelSpecificData = this.getDataForChannel(channel);
    return this.create({
      ...overrides,
      channel,
      ...channelSpecificData,
    });
  }

  static createWithStatus(status: TemplateStatus, overrides: Partial<Template> = {}): Template {
    return this.create({ ...overrides, status });
  }

  static createWithVersion(version: number, overrides: Partial<Template> = {}): Template {
    return this.create({ ...overrides, version });
  }

  static createEmailTemplate(overrides: Partial<Template> = {}): Template {
    return this.create({
      ...overrides,
      channel: NotificationChannel.EMAIL,
      subject: "Email Subject: {{title}}",
      data: `
        <html>
          <body>
            <h1>Hello {{name}}</h1>
            <p>{{message}}</p>
            <a href="{{actionUrl}}">Click here</a>
          </body>
        </html>
      `,
      variables: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "Recipient name",
        },
        {
          name: "title",
          type: "string",
          required: true,
          description: "Email title",
        },
        {
          name: "message",
          type: "string",
          required: true,
          description: "Email message",
        },
        {
          name: "actionUrl",
          type: "string",
          required: false,
          description: "Action URL",
        },
      ],
    });
  }

  static createSMSTemplate(overrides: Partial<Template> = {}): Template {
    return this.create({
      ...overrides,
      channel: NotificationChannel.SMS,
      subject: undefined,
      data: "Hi {{name}}, {{message}}. Reply STOP to opt out.",
      variables: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "Recipient name",
        },
        {
          name: "message",
          type: "string",
          required: true,
          description: "SMS message",
        },
      ],
    });
  }

  static createPushTemplate(overrides: Partial<Template> = {}): Template {
    return this.create({
      ...overrides,
      channel: NotificationChannel.PUSH,
      subject: "{{title}}",
      data: "{{body}}",
      variables: [
        {
          name: "title",
          type: "string",
          required: true,
          description: "Push notification title",
        },
        {
          name: "body",
          type: "string",
          required: true,
          description: "Push notification body",
        },
      ],
    });
  }

  private static getDataForChannel(channel: NotificationChannel) {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return {
          subject: "Email: {{subject}}",
          data: "<p>Hello {{name}}, {{message}}</p>",
        };
      case NotificationChannel.SMS:
        return {
          subject: undefined,
          data: "SMS: {{name}}, {{message}}",
        };
      case NotificationChannel.PUSH:
        return {
          subject: "{{title}}",
          data: "{{body}}",
        };
      case NotificationChannel.WHATSAPP:
        return {
          subject: undefined,
          data: "WhatsApp: {{name}}, {{message}}",
        };
      case NotificationChannel.IN_APP:
        return {
          subject: "{{title}}",
          data: "{{message}}",
        };
      default:
        return {
          subject: "Default Subject",
          data: "Default content",
        };
    }
  }
}
