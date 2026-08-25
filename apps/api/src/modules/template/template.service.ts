import { Injectable } from "@nestjs/common";

@Injectable()
export class TemplateService {
  async render(_input: {
    templateId: string;
    tenantId: string;
    data?: unknown;
  }): Promise<{ content: string; subject?: string }> {
    throw new Error("Message templates are not available");
  }
}
