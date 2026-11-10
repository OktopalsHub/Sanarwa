import type { TemplateVariable, VariableValidation } from "@/lib/types/template";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class VariableValidator {
  static validateVariable(variable: TemplateVariable): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!variable.name.trim()) {
      errors.push("Variable name is required");
    } else {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
        errors.push(
          "Variable name must start with a letter or underscore and contain only letters, numbers, and underscores",
        );
      }

      if (variable.name.length > 50) {
        warnings.push("Variable name is quite long, consider shortening it");
      }
    }

    this.validateByType(variable, errors, warnings);

    if (variable.validation) {
      this.validateValidationRules(variable.validation, variable.type, errors, warnings);
    }

    if (variable.defaultValue !== undefined && variable.defaultValue !== "") {
      this.validateDefaultValue(variable, errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateVariableSet(variables: TemplateVariable[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const names = new Set<string>();

    variables.forEach((variable, index) => {
      if (names.has(variable.name)) {
        errors.push(`Duplicate variable name "${variable.name}" at position ${index + 1}`);
      } else {
        names.add(variable.name);
      }

      const result = this.validateVariable(variable);
      errors.push(...result.errors.map((error) => `Variable "${variable.name}": ${error}`));
      warnings.push(...result.warnings.map((warning) => `Variable "${variable.name}": ${warning}`));
    });

    const reservedNames = ["user", "tenant", "campaign", "template", "system", "date", "time"];
    variables.forEach((variable) => {
      if (reservedNames.includes(variable.name.toLowerCase())) {
        warnings.push(`Variable name "${variable.name}" is reserved and might cause conflicts`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateVariableValue(variable: TemplateVariable, value: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (variable.required && (value === undefined || value === null || value === "")) {
      errors.push(`Variable "${variable.name}" is required but no value provided`);
      return { isValid: false, errors, warnings };
    }

    if (!variable.required && (value === undefined || value === null || value === "")) {
      return { isValid: true, errors, warnings };
    }

    this.validateValueByType(variable, value, errors, warnings);

    if (variable.validation) {
      this.validateValueAgainstRules(variable.validation, value, errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateByType(variable: TemplateVariable, errors: string[], warnings: string[]) {
    switch (variable.type) {
      case "email":
        if (variable.defaultValue && !this.isValidEmail(variable.defaultValue)) {
          errors.push("Default value is not a valid email address");
        }
        break;
      case "url":
        if (variable.defaultValue && !this.isValidUrl(variable.defaultValue)) {
          errors.push("Default value is not a valid URL");
        }
        break;
      case "number":
        if (variable.defaultValue && isNaN(Number(variable.defaultValue))) {
          errors.push("Default value is not a valid number");
        }
        break;
      case "date":
        if (variable.defaultValue && !this.isValidDate(variable.defaultValue)) {
          errors.push("Default value is not a valid date");
        }
        break;
      case "boolean":
        if (
          variable.defaultValue !== undefined &&
          typeof variable.defaultValue !== "boolean" &&
          !["true", "false", "1", "0"].includes(String(variable.defaultValue).toLowerCase())
        ) {
          errors.push("Default value is not a valid boolean");
        }
        break;
    }
  }

  private static validateValidationRules(
    validation: VariableValidation,
    type: string,
    errors: string[],
    warnings: string[],
  ) {
    if (validation.minLength !== undefined && validation.maxLength !== undefined) {
      if (validation.minLength > validation.maxLength) {
        errors.push("Minimum length cannot be greater than maximum length");
      }
    }

    if (validation.minLength !== undefined && validation.minLength < 0) {
      errors.push("Minimum length cannot be negative");
    }

    if (validation.maxLength !== undefined && validation.maxLength < 1) {
      errors.push("Maximum length must be at least 1");
    }

    if (validation.pattern) {
      try {
        new RegExp(validation.pattern);
      } catch {
        errors.push("Invalid regular expression pattern");
      }
    }

    if (
      type === "number" &&
      (validation.minLength !== undefined || validation.maxLength !== undefined)
    ) {
      warnings.push("Length validation is not applicable for number type");
    }

    if (type === "boolean" && validation.pattern) {
      warnings.push("Pattern validation is not applicable for boolean type");
    }
  }

  private static validateDefaultValue(
    variable: TemplateVariable,
    errors: string[],
    warnings: string[],
  ) {
    const valueValidation = this.validateVariableValue(variable, variable.defaultValue);
    errors.push(...valueValidation.errors);
    warnings.push(...valueValidation.warnings);
  }

  private static validateValueByType(
    variable: TemplateVariable,
    value: any,
    errors: string[],
    warnings: string[],
  ) {
    switch (variable.type) {
      case "email":
        if (typeof value === "string" && !this.isValidEmail(value)) {
          errors.push("Value is not a valid email address");
        }
        break;
      case "url":
        if (typeof value === "string" && !this.isValidUrl(value)) {
          errors.push("Value is not a valid URL");
        }
        break;
      case "number":
        if (isNaN(Number(value))) {
          errors.push("Value is not a valid number");
        }
        break;
      case "date":
        if (!this.isValidDate(value)) {
          errors.push("Value is not a valid date");
        }
        break;
      case "boolean":
        if (
          typeof value !== "boolean" &&
          !["true", "false", "1", "0"].includes(String(value).toLowerCase())
        ) {
          errors.push("Value is not a valid boolean");
        }
        break;
      case "image":
        if (typeof value === "string" && !this.isValidImageUrl(value)) {
          warnings.push("Value does not appear to be a valid image URL");
        }
        break;
    }
  }

  private static validateValueAgainstRules(
    validation: VariableValidation,
    value: any,
    errors: string[],
    warnings: string[],
  ) {
    const stringValue = String(value);

    if (validation.minLength !== undefined && stringValue.length < validation.minLength) {
      errors.push(`Value must be at least ${validation.minLength} characters long`);
    }

    if (validation.maxLength !== undefined && stringValue.length > validation.maxLength) {
      errors.push(`Value must be no more than ${validation.maxLength} characters long`);
    }

    if (validation.pattern) {
      try {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(stringValue)) {
          errors.push("Value does not match the required pattern");
        }
      } catch {}
    }

    if (validation.options && validation.options.length > 0) {
      if (!validation.options.includes(stringValue)) {
        errors.push(`Value must be one of: ${validation.options.join(", ")}`);
      }
    }
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static isValidDate(date: any): boolean {
    if (date instanceof Date) {
      return !isNaN(date.getTime());
    }

    if (typeof date === "string") {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    }

    return false;
  }

  private static isValidImageUrl(url: string): boolean {
    if (!this.isValidUrl(url)) {
      return false;
    }

    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"];
    const urlLower = url.toLowerCase();

    return (
      imageExtensions.some((ext) => urlLower.includes(ext)) ||
      urlLower.includes("image") ||
      urlLower.includes("img")
    );
  }
}

export class TemplateProcessor {
  static extractVariables(content: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const variableName = match[1]?.trim();
      if (variableName && !variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  static processTemplate(content: string, variables: Record<string, any>): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const trimmedName = variableName.trim();
      return variables[trimmedName] !== undefined ? String(variables[trimmedName]) : match;
    });
  }

  static validateTemplateVariables(
    content: string,
    definedVariables: TemplateVariable[],
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const usedVariables = this.extractVariables(content);
    const definedNames = definedVariables.map((v) => v.name);

    usedVariables.forEach((variableName) => {
      if (!definedNames.includes(variableName)) {
        errors.push(`Variable "${variableName}" is used in template but not defined`);
      }
    });

    definedNames.forEach((variableName) => {
      if (!usedVariables.includes(variableName)) {
        warnings.push(`Variable "${variableName}" is defined but not used in template`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
