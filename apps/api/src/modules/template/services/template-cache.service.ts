import { Injectable } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { RenderedTemplate } from "../dto/render-template.dto";
import { Template } from "../template.entity";

@Injectable()
export class TemplateCacheService {
  private readonly TEMPLATE_CACHE_PREFIX = "template:";
  private readonly RENDERED_CACHE_PREFIX = "rendered:";
  private readonly DEFAULT_TTL = 3600;
  private readonly RENDERED_TTL = 300;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async cacheTemplate(template: Template): Promise<void> {
    const key = this.getTemplateKey(template.id);
    await this.redis.setex(key, this.DEFAULT_TTL, JSON.stringify(template));
  }

  async getCachedTemplate(templateId: string): Promise<Template | null> {
    const key = this.getTemplateKey(templateId);
    const cached = await this.redis.get(key);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as Template;
    } catch (error) {
      await this.redis.del(key);
      return null;
    }
  }

  async cacheRenderedTemplate(
    templateId: string,
    dataHash: string,
    rendered: RenderedTemplate,
  ): Promise<void> {
    const key = this.getRenderedKey(templateId, dataHash);
    await this.redis.setex(key, this.RENDERED_TTL, JSON.stringify(rendered));
  }

  async getCachedRenderedTemplate(
    templateId: string,
    dataHash: string,
  ): Promise<RenderedTemplate | null> {
    const key = this.getRenderedKey(templateId, dataHash);
    const cached = await this.redis.get(key);

    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as RenderedTemplate;
    } catch (error) {
      await this.redis.del(key);
      return null;
    }
  }

  async invalidateTemplate(templateId: string): Promise<void> {
    const templateKey = this.getTemplateKey(templateId);
    await this.redis.del(templateKey);

    await this.invalidateRenderedTemplates(templateId);
  }

  async invalidateRenderedTemplates(templateId: string): Promise<void> {
    const pattern = this.getRenderedKey(templateId, "*");
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateTenantTemplates(tenantId: string): Promise<void> {
    const pattern = `${this.TEMPLATE_CACHE_PREFIX}*`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const cached = await this.redis.get(key);
      if (cached) {
        try {
          const template = JSON.parse(cached) as Template;
          if (template.tenant.id === tenantId) {
            await this.redis.del(key);
          }
        } catch (error) {
          await this.redis.del(key);
        }
      }
    }
  }

  async cacheTemplates(templates: Template[]): Promise<void> {
    if (templates.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const template of templates) {
      const key = this.getTemplateKey(template.id);
      pipeline.setex(key, this.DEFAULT_TTL, JSON.stringify(template));
    }

    await pipeline.exec();
  }

  async getCachedTemplates(templateIds: string[]): Promise<(Template | null)[]> {
    if (templateIds.length === 0) return [];

    const keys = templateIds.map((id) => this.getTemplateKey(id));
    const cached = await this.redis.mget(...keys);

    return cached.map((item, index) => {
      if (!item) return null;

      try {
        return JSON.parse(item) as Template;
      } catch (error) {
        this.redis.del(keys[index]).catch(() => {});
        return null;
      }
    });
  }

  async isTemplateCached(templateId: string): Promise<boolean> {
    const key = this.getTemplateKey(templateId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async getCacheStats(): Promise<{
    templateCount: number;
    renderedCount: number;
    totalMemory: string;
  }> {
    const templateKeys = await this.redis.keys(`${this.TEMPLATE_CACHE_PREFIX}*`);
    const renderedKeys = await this.redis.keys(`${this.RENDERED_CACHE_PREFIX}*`);
    const memoryInfo = await this.redis.memory("STATS");

    let usedMemory = 0;
    if (Array.isArray(memoryInfo)) {
      const usedMemoryIndex = memoryInfo.indexOf("used_memory");
      if (usedMemoryIndex !== -1 && usedMemoryIndex + 1 < memoryInfo.length) {
        usedMemory = parseInt(memoryInfo[usedMemoryIndex + 1] as string, 10) || 0;
      }
    }

    return {
      templateCount: templateKeys.length,
      renderedCount: renderedKeys.length,
      totalMemory: this.formatBytes(usedMemory),
    };
  }

  async clearAllCaches(): Promise<void> {
    const templateKeys = await this.redis.keys(`${this.TEMPLATE_CACHE_PREFIX}*`);
    const renderedKeys = await this.redis.keys(`${this.RENDERED_CACHE_PREFIX}*`);

    const allKeys = [...templateKeys, ...renderedKeys];
    if (allKeys.length > 0) {
      await this.redis.del(...allKeys);
    }
  }

  generateDataHash(data: Record<string, any>): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  }

  private getTemplateKey(templateId: string): string {
    return `${this.TEMPLATE_CACHE_PREFIX}${templateId}`;
  }

  private getRenderedKey(templateId: string, dataHash: string): string {
    return `${this.RENDERED_CACHE_PREFIX}${templateId}:${dataHash}`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
