import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as Handlebars from "handlebars";
import { Template } from "./template.entity";

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(Template)
    private readonly repo: Repository<Template>,
  ) {}

  async render(input: { templateId: string; tenantId: string; data?: Record<string, any> }): Promise<{ content: string; subject?: string; data?: Record<string, any> }> {
    const tpl = await this.repo.findOne({ where: { id: input.templateId, tenantId: input.tenantId } });
    if (!tpl) throw new NotFoundException("Template not found");
    const d = input.data || {};
    const compile = (str?: string) => {
      if (!str) return undefined;
      try { return Handlebars.compile(str)(d); } catch { return str; }
    };
    const subject = compile(tpl.subject);
    const content = compile(tpl.content) || compile(tpl.data?.html) || compile(tpl.data?.text) || "";
    const data: Record<string, any> = {};
    if (tpl.data) {
      for (const [k, v] of Object.entries(tpl.data)) if (typeof v === "string") data[k] = compile(v);
    }
    return { content: content || "", subject, data };
  }

  extractVariables(str: string): string[] {
    const re = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
    const vars = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(str))) vars.add(m[1]);
    return [...vars];
  }
}
