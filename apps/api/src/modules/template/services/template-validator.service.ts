import { Injectable } from "@nestjs/common";
import * as Handlebars from "handlebars";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { Template } from "../template.entity";
import { TemplateVariable } from "../../../common/interfaces";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class TemplateValidatorService {
  async validateTemplate(template: Template): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!template.data) {
      errors.push("Template must have data");
      return {
        isValid: false,
        errors,
        warnings,
      };
    }

    const syntaxValidation = this.validateSyntax(template.data, template.subject);
    errors.push(...syntaxValidation.errors);
    warnings.push(...syntaxValidation.warnings);

    const variableValidation = this.validateVariables(
      template.data,
      template.subject,
      template.variables ?? [],
    );
    errors.push(...variableValidation.errors);
    warnings.push(...variableValidation.warnings);

    const channelValidation = this.validateChannelSpecific(template);
    errors.push(...channelValidation.errors);
    warnings.push(...channelValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateSyntax(content: string, subject?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const template = Handlebars.compile(content);
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

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateVariables(
    content: string,
    subject: string | undefined,
    variables: TemplateVariable[],
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const usedVariables = new Set<string>();
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;

    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      const variableName = match[1].trim().split(".")[0].split(" ")[0];
      usedVariables.add(variableName);
    }

    if (subject) {
      variableRegex.lastIndex = 0;
      while ((match = variableRegex.exec(subject)) !== null) {
        const variableName = match[1].trim().split(".")[0].split(" ")[0];
        usedVariables.add(variableName);
      }
    }

    const definedVariables = new Set(variables.map((v) => v.name));

    for (const usedVar of usedVariables) {
      if (!definedVariables.has(usedVar) && !this.isHandlebarsHelper(usedVar)) {
        errors.push(`Variable '${usedVar}' is used but not defined`);
      }
    }

    for (const definedVar of definedVariables) {
      if (!usedVariables.has(definedVar)) {
        warnings.push(`Variable '${definedVar}' is defined but not used`);
      }
    }

    for (const variable of variables) {
      if (!variable.name || variable.name.trim() === "") {
        errors.push("Variable name cannot be empty");
      }

      if (variable.required && variable.defaultValue === undefined) {
      }

      if (variable.validation) {
        const validation = variable.validation;
        if (variable.type === "string") {
          if (validation.minLength !== undefined && validation.minLength < 0) {
            errors.push(`Variable '${variable.name}' has invalid minLength`);
          }
          if (validation.maxLength !== undefined && validation.maxLength < 0) {
            errors.push(`Variable '${variable.name}' has invalid maxLength`);
          }
          if (
            validation.minLength !== undefined &&
            validation.maxLength !== undefined &&
            validation.minLength > validation.maxLength
          ) {
            errors.push(`Variable '${variable.name}' minLength cannot be greater than maxLength`);
          }
        }

        if (variable.type === "number") {
          if (
            validation.min !== undefined &&
            validation.max !== undefined &&
            validation.min > validation.max
          ) {
            errors.push(`Variable '${variable.name}' min cannot be greater than max`);
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateChannelSpecific(template: Template): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (template.channel) {
      case NotificationChannel.EMAIL:
        if (!template.subject || template.subject.trim() === "") {
          errors.push("Email templates must have a subject");
        }

        if (template.channelSpecific?.email?.fromEmail) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(template.channelSpecific.email.fromEmail)) {
            errors.push("Invalid fromEmail format");
          }
        }

        if (template.channelSpecific?.email?.replyTo) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(template.channelSpecific.email.replyTo)) {
            errors.push("Invalid replyTo email format");
          }
        }
        break;

      case NotificationChannel.SMS:
        if (template.data && template.data.length > 1600) {
          warnings.push(
            "SMS content is longer than 1600 characters and may be split into multiple messages",
          );
        }

        if (template.subject) {
          warnings.push("SMS templates do not typically use subjects");
        }
        break;

      case NotificationChannel.PUSH:
        if (!template.channelSpecific?.push?.title && !template.subject) {
          errors.push(
            "Push notifications must have a title (either in subject or channelSpecific.push.title)",
          );
        }

        if (template.data && template.data.length > 4000) {
          warnings.push("Push notification content is very long and may be truncated");
        }
        break;

      case NotificationChannel.WHATSAPP:
        if (
          template.channelSpecific?.whatsapp?.templateType === "media" &&
          !template.channelSpecific.whatsapp.mediaUrl
        ) {
          errors.push("WhatsApp media templates must specify mediaUrl");
        }

        if (template.data && template.data.length > 4096) {
          errors.push("WhatsApp message content cannot exceed 4096 characters");
        }
        break;

      case NotificationChannel.IN_APP:
        if (template.data && template.data.length > 1000) {
          warnings.push("In-app notification content is quite long");
        }
        break;
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private isHandlebarsHelper(name: string): boolean {
    const helpers = [
      "if",
      "unless",
      "each",
      "with",
      "lookup",
      "log",
      "blockHelperMissing",
      "helperMissing",
    ];
    return helpers.includes(name);
  }

  validateTemplateData(variables: TemplateVariable[], data: Record<string, any>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const variable of variables) {
      const value = data[variable.name];

      if (variable.required && (value === undefined || value === null || value === "")) {
        if (variable.defaultValue === undefined) {
          errors.push(`Required variable '${variable.name}' is missing`);
        }
      }

      if (value !== undefined && value !== null) {
        const actualType = typeof value;
        const expectedType = variable.type;

        if (expectedType === "date" && !(value instanceof Date) && typeof value !== "string") {
          errors.push(`Variable '${variable.name}' should be a date but got ${actualType}`);
        } else if (
          expectedType !== "object" &&
          expectedType !== "date" &&
          actualType !== expectedType
        ) {
          errors.push(
            `Variable '${variable.name}' should be ${expectedType} but got ${actualType}`,
          );
        }

        if (variable.validation && typeof value === "string") {
          const validation = variable.validation;

          if (validation.minLength !== undefined && value.length < validation.minLength) {
            errors.push(
              `Variable '${variable.name}' is too short (minimum ${validation.minLength} characters)`,
            );
          }

          if (validation.maxLength !== undefined && value.length > validation.maxLength) {
            errors.push(
              `Variable '${variable.name}' is too long (maximum ${validation.maxLength} characters)`,
            );
          }

          if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            errors.push(`Variable '${variable.name}' does not match required pattern`);
          }
        }

        if (variable.validation && typeof value === "number") {
          const validation = variable.validation;

          if (validation.min !== undefined && value < validation.min) {
            errors.push(`Variable '${variable.name}' is too small (minimum ${validation.min})`);
          }

          if (validation.max !== undefined && value > validation.max) {
            errors.push(`Variable '${variable.name}' is too large (maximum ${validation.max})`);
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
