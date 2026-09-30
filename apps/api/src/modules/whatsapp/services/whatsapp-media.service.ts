import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

export interface MediaUploadResponse {
  id: string;
  url?: string;
  type: string;
  size: number;
}

export interface MediaMessage {
  type: "image" | "video" | "document" | "audio";
  url: string;
  caption?: string;
}

@Injectable()
export class WhatsAppMediaService {
  private readonly logger = new Logger(WhatsAppMediaService.name);
  private readonly baseUrl = "https://graph.facebook.com/v18.0";

  constructor(private readonly httpService: HttpService) {}

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(
    phoneNumberId: string,
    accessToken: string,
    mediaBuffer: Buffer,
    mediaType: "image/jpeg" | "image/png" | "video/mp4" | "application/pdf" | "audio/mpeg",
    filename: string,
  ): Promise<MediaUploadResponse> {
    try {
      this.logger.log(`Uploading media: ${filename} (${mediaType})`);

      const formData = new FormData();
      const blob = new Blob([Buffer.from(mediaBuffer)], { type: mediaType });
      formData.append("file", blob, filename);
      formData.append("type", mediaType);

      const url = `${this.baseUrl}/${phoneNumberId}/media`;

      const response = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      this.logger.log(`Media uploaded successfully: ${response.data.id}`);

      return {
        id: response.data.id,
        type: mediaType,
        size: mediaBuffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload media: ${filename}`, error.message);
      throw new BadRequestException(`Media upload failed: ${error.message}`);
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(mediaId: string, accessToken: string): Promise<Buffer> {
    try {
      this.logger.log(`Downloading media: ${mediaId}`);

      // Get media URL
      const urlResponse = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${mediaId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      const mediaUrl = urlResponse.data.url;

      // Download media
      const mediaResponse = await firstValueFrom(
        this.httpService.get(mediaUrl, {
          responseType: "arraybuffer",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      this.logger.log(`Media downloaded successfully: ${mediaId}`);

      return Buffer.from(mediaResponse.data);
    } catch (error) {
      this.logger.error(`Failed to download media: ${mediaId}`, error.message);
      throw new BadRequestException(`Media download failed: ${error.message}`);
    }
  }

  /**
   * Send media message
   */
  async sendMediaMessage(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    media: MediaMessage,
  ): Promise<{ messageId: string }> {
    try {
      this.logger.log(`Sending ${media.type} message to ${to}`);

      const payload = {
        messaging_product: "whatsapp",
        to,
        type: media.type,
        [media.type]: {
          link: media.url,
          ...(media.caption && { caption: media.caption }),
        },
      };

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/${phoneNumberId}/messages`, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }),
      );

      this.logger.log(`Media message sent successfully: ${response.data.messages[0].id}`);

      return {
        messageId: response.data.messages[0].id,
      };
    } catch (error) {
      this.logger.error(`Failed to send media message to ${to}`, error.message);
      throw new BadRequestException(`Media message send failed: ${error.message}`);
    }
  }

  /**
   * Validate media file
   */
  validateMediaFile(
    buffer: Buffer,
    mediaType: string,
    maxSize: number = 16 * 1024 * 1024, // 16MB default
  ): { isValid: boolean; error?: string } {
    // Check size
    if (buffer.length > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
      };
    }

    // Check type
    const validTypes = ["image/jpeg", "image/png", "video/mp4", "application/pdf", "audio/mpeg"];

    if (!validTypes.includes(mediaType)) {
      return {
        isValid: false,
        error: `Unsupported media type: ${mediaType}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get media info
   */
  async getMediaInfo(
    mediaId: string,
    accessToken: string,
  ): Promise<{ id: string; type: string; size?: number }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${mediaId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      return {
        id: response.data.id,
        type: response.data.mime_type,
        size: response.data.file_size,
      };
    } catch (error) {
      this.logger.error(`Failed to get media info: ${mediaId}`, error.message);
      throw new BadRequestException(`Get media info failed: ${error.message}`);
    }
  }
}
