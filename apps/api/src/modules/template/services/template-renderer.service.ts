import { Injectable } from "@nestjs/common";
import * as Handlebars from "handlebars";
import { RenderedTemplate } from "../dto/render-template.dto";
import { Template } from "../template.entity";
import { TemplateValidatorService, ValidationResult } from "./template-validator.service";
import { TemplateVariable } from "../../../common/interfaces";

@Injectable()
export class TemplateRendererService {
  constructor(private readonly validatorService: TemplateValidatorService) {
    this.registerHandlebarsHelpers();
  }

  async renderTemplate(template: Template, data: Record<string, any>): Promise<RenderedTemplate> {
    const validation = this.validatorService.validateTemplateData(template.variables ?? [], data);
    if (!validation.isValid) {
      throw new Error(`Template data validation failed: ${validation.errors.join(", ")}`);
    }

    const renderData = this.prepareRenderData(template.variables ?? [], data);

    const dataTemplate = Handlebars.compile(template.data);
    const renderedData = dataTemplate(renderData);

    let renderedSubject: string | undefined;
    if (template.subject) {
      const subjectTemplate = Handlebars.compile(template.subject);
      renderedSubject = subjectTemplate(renderData);
    }

    let renderedChannelSpecific: any;
    if (template.channelSpecific) {
      renderedChannelSpecific = this.renderChannelSpecific(template.channelSpecific, renderData);
    }

    return {
      subject: renderedSubject,
      data: renderedData,
      channelSpecific: renderedChannelSpecific,
      variables: renderData,
      templateId: template.id,
      version: template.version,
    };
  }

  private prepareRenderData(
    variables: TemplateVariable[],
    data: Record<string, any>,
  ): Record<string, any> {
    const renderData = { ...data };

    for (const variable of variables) {
      if (renderData[variable.name] === undefined || renderData[variable.name] === null) {
        if (variable.defaultValue !== undefined) {
          renderData[variable.name] = variable.defaultValue;
        } else if (variable.required) {
          throw new Error(
            `Required variable '${variable.name}' is missing and has no default value`,
          );
        }
      }

      if (renderData[variable.name] !== undefined) {
        renderData[variable.name] = this.formatVariableValue(variable, renderData[variable.name]);
      }
    }

    return renderData;
  }

  private formatVariableValue(variable: TemplateVariable, value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (variable.type) {
      case "string":
        return String(value);

      case "number":
        const num = Number(value);
        return isNaN(num) ? value : num;

      case "boolean":
        if (typeof value === "boolean") return value;
        if (typeof value === "string") {
          return value.toLowerCase() === "true" || value === "1";
        }
        return Boolean(value);

      case "date":
        if (value instanceof Date) return value;
        if (typeof value === "string" || typeof value === "number") {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date;
        }
        return value;

      case "object":
        return value;

      default:
        return value;
    }
  }

  private renderChannelSpecific(channelSpecific: any, data: Record<string, any>): any {
    if (!channelSpecific || typeof channelSpecific !== "object") {
      return channelSpecific;
    }

    const rendered = {};

    for (const [key, value] of Object.entries(channelSpecific)) {
      if (typeof value === "string") {
        try {
          const template = Handlebars.compile(value);
          rendered[key] = template(data);
        } catch (error) {
          rendered[key] = value;
        }
      } else if (typeof value === "object" && value !== null) {
        rendered[key] = this.renderChannelSpecific(value, data);
      } else {
        rendered[key] = value;
      }
    }

    return rendered;
  }

  private registerHandlebarsHelpers(): void {
    Handlebars.registerHelper("formatDate", function (date: any, format?: string) {
      if (!date) return "";

      const d = new Date(date);
      if (isNaN(d.getTime())) return date;

      switch (format) {
        case "short":
          return d.toLocaleDateString();
        case "long":
          return d.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        case "time":
          return d.toLocaleTimeString();
        case "datetime":
          return d.toLocaleString();
        case "iso":
          return d.toISOString();
        default:
          return d.toLocaleDateString();
      }
    });

    Handlebars.registerHelper("formatNumber", function (number: any, decimals?: number) {
      if (typeof number !== "number") return number;

      if (decimals !== undefined) {
        return number.toFixed(decimals);
      }

      return number.toLocaleString();
    });

    Handlebars.registerHelper("formatCurrency", function (amount: any, currency: string = "USD") {
      if (typeof amount !== "number") return amount;

      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
      }).format(amount);
    });

    Handlebars.registerHelper("upper", function (str: any) {
      if (typeof str !== "string") return str;
      return str.toUpperCase();
    });

    Handlebars.registerHelper("lower", function (str: any) {
      if (typeof str !== "string") return str;
      return str.toLowerCase();
    });

    Handlebars.registerHelper("capitalize", function (str: any) {
      if (typeof str !== "string") return str;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    Handlebars.registerHelper("truncate", function (str: any, length: number = 100) {
      if (typeof str !== "string") return str;
      if (str.length <= length) return str;
      return str.substring(0, length) + "...";
    });

    Handlebars.registerHelper("default", function (value: any, defaultValue: any) {
      return value || defaultValue;
    });

    Handlebars.registerHelper("eq", function (a: any, b: any) {
      return a === b;
    });

    Handlebars.registerHelper("ne", function (a: any, b: any) {
      return a !== b;
    });

    Handlebars.registerHelper("gt", function (a: any, b: any) {
      return a > b;
    });

    Handlebars.registerHelper("lt", function (a: any, b: any) {
      return a < b;
    });

    Handlebars.registerHelper("length", function (array: any) {
      if (Array.isArray(array)) return array.length;
      if (typeof array === "string") return array.length;
      if (typeof array === "object" && array !== null) return Object.keys(array).length;
      return 0;
    });

    Handlebars.registerHelper("join", function (array: any, separator: string = ", ") {
      if (Array.isArray(array)) return array.join(separator);
      return array;
    });
  }

  async validateTemplateSyntax(data: string, subject?: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const template = Handlebars.compile(data);
      template({});
    } catch (error) {
      errors.push(`Content syntax error: ${error.message}`);
    }

    if (subject) {
      try {
        const template = Handlebars.compile(subject);
        template({});
      } catch (error) {
        errors.push(`Subject syntax error: ${error.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
