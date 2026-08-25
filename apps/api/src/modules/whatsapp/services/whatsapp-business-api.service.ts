import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

export interface WhatsAppTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  parameters?: Array<{
    type: "text" | "currency" | "date_time" | "image" | "document" | "video";
    text?: string;
  }>;
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface WhatsAppTemplateRequest {
  name: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  components: WhatsAppTemplateComponent[];
}

export interface WhatsAppMessageRequest {
  messaging_product: "whatsapp";
  to: string;
  type: "template" | "text";
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
  text?: {
    body: string;
  };
}

@Injectable()
export class WhatsAppBusinessAPIService {
  private readonly logger = new Logger(WhatsAppBusinessAPIService.name);
  private readonly baseUrl: string;
  private readonly accessToken: string | undefined;
  private readonly phoneNumberId: string | undefined;
  private readonly businessAccountId: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      "WHATSAPP_API_BASE_URL",
      "https://graph.facebook.com/v18.0",
    );
    this.accessToken = this.configService.get<string>("WHATSAPP_ACCESS_TOKEN");
    this.phoneNumberId = this.configService.get<string>("WHATSAPP_PHONE_NUMBER_ID");
    this.businessAccountId = this.configService.get<string>("WHATSAPP_BUSINESS_ACCOUNT_ID");

    if (!this.accessToken || !this.phoneNumberId || !this.businessAccountId) {
      this.logger.warn("WhatsApp Business API credentials not configured");
    }
  }

  /**
   * Create a new WhatsApp message template
   */
  async createTemplate(
    templateRequest: WhatsAppTemplateRequest,
  ): Promise<{ id: string; status: string }> {
    try {
      this.logger.log(`Creating WhatsApp template: ${templateRequest.name}`);

      const url = `${this.baseUrl}/${this.businessAccountId}/message_templates`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await firstValueFrom(
        this.httpService.post(url, templateRequest, { headers }),
      );

      this.logger.log(`WhatsApp template created successfully: ${response.data.id}`);
      return {
        id: response.data.id,
        status: response.data.status || "PENDING",
      };
    } catch (error) {
      this.logger.error(
        `Failed to create WhatsApp template: ${templateRequest.name}`,
        error.response?.data || error.message,
      );
      throw new HttpException(
        `Failed to create WhatsApp template: ${error.response?.data?.error?.message || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Send a WhatsApp message using a template
   */
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    languageCode: string = "en",
    components?: Array<{ type: string; parameters: Array<{ type: string; text: string }> }>,
  ): Promise<{ messageId: string }> {
    try {
      this.logger.log(
        `Sending WhatsApp template message to ${phoneNumber} using template ${templateName}`,
      );

      // Clean phone number (remove any non-numeric characters except +)
      const cleanPhoneNumber = phoneNumber.replace(/[^\d+]/g, "");

      const messageRequest: WhatsAppMessageRequest = {
        messaging_product: "whatsapp",
        to: cleanPhoneNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components || [],
        },
      };

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await firstValueFrom(
        this.httpService.post(url, messageRequest, { headers }),
      );

      this.logger.log(`WhatsApp message sent successfully: ${response.data.messages[0].id}`);
      return {
        messageId: response.data.messages[0].id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message to ${phoneNumber}`,
        error.response?.data || error.message,
      );
      throw new HttpException(
        `Failed to send WhatsApp message: ${error.response?.data?.error?.message || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Send a simple text message (for testing)
   */
  async sendTextMessage(phoneNumber: string, message: string): Promise<{ messageId: string }> {
    try {
      this.logger.log(`Sending WhatsApp text message to ${phoneNumber}`);

      const cleanPhoneNumber = phoneNumber.replace(/[^\d+]/g, "");

      const messageRequest: WhatsAppMessageRequest = {
        messaging_product: "whatsapp",
        to: cleanPhoneNumber,
        type: "text",
        text: {
          body: message,
        },
      };

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      };

      const response = await firstValueFrom(
        this.httpService.post(url, messageRequest, { headers }),
      );

      this.logger.log(`WhatsApp text message sent successfully: ${response.data.messages[0].id}`);
      return {
        messageId: response.data.messages[0].id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp text message to ${phoneNumber}`,
        error.response?.data || error.message,
      );
      throw new HttpException(
        `Failed to send WhatsApp text message: ${error.response?.data?.error?.message || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get template status
   */
  async getTemplateStatus(templateId: string): Promise<{ status: string; reason?: string }> {
    try {
      const url = `${this.baseUrl}/${templateId}`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
      };

      const response = await firstValueFrom(this.httpService.get(url, { headers }));

      return {
        status: response.data.status,
        reason: response.data.reason,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get template status for ${templateId}`,
        error.response?.data || error.message,
      );
      throw new HttpException(
        `Failed to get template status: ${error.response?.data?.error?.message || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * List all templates for the business account
   */
  async listTemplates(): Promise<
    Array<{ id: string; name: string; status: string; category: string }>
  > {
    try {
      const url = `${this.baseUrl}/${this.businessAccountId}/message_templates`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
      };

      const response = await firstValueFrom(this.httpService.get(url, { headers }));

      return response.data.data.map((template: any) => ({
        id: template.id,
        name: template.name,
        status: template.status,
        category: template.category,
      }));
    } catch (error) {
      this.logger.error("Failed to list WhatsApp templates", error.response?.data || error.message);
      throw new HttpException(
        `Failed to list templates: ${error.response?.data?.error?.message || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<{ success: boolean }> {
    try {
      const url = `${this.baseUrl}/${this.businessAccountId}/message_templates`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
      };

      await firstValueFrom(
        this.httpService.delete(url, {
          headers,
          data: { hsm_id: templateId },
        }),
      );

      this.logger.log(`WhatsApp template deleted successfully: ${templateId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to delete WhatsApp template ${templateId}`,
        error.response?.data || error.message,
      );
      throw new HttpException(
        `Failed to delete template: ${error.response?.data?.error?.message || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): {
    isValid: boolean;
    cleanNumber?: string;
    error?: string;
  } {
    // Remove all non-numeric characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, "");

    // Check if it starts with + and has at least 10 digits
    if (!cleaned.startsWith("+")) {
      return { isValid: false, error: "Phone number must start with country code (+)" };
    }

    // Remove + for length check
    const digits = cleaned.substring(1);

    if (digits.length < 10 || digits.length > 15) {
      return { isValid: false, error: "Phone number must be between 10-15 digits" };
    }

    return { isValid: true, cleanNumber: cleaned };
  }

  /**
   * Get WhatsApp Business API health status
   */
  async getHealthStatus(): Promise<{
    status: string;
    phoneNumberId: string | undefined;
    businessAccountId: string | undefined;
  }> {
    try {
      // Try to get phone number info as a health check
      const url = `${this.baseUrl}/${this.phoneNumberId}`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
      };

      const response = await firstValueFrom(this.httpService.get(url, { headers }));

      return {
        status: "healthy",
        phoneNumberId: this.phoneNumberId,
        businessAccountId: this.businessAccountId,
      };
    } catch (error) {
      this.logger.error(
        "WhatsApp Business API health check failed",
        error.response?.data || error.message,
      );
      return {
        status: "unhealthy",
        phoneNumberId: this.phoneNumberId,
        businessAccountId: this.businessAccountId,
      };
    }
  }
}
