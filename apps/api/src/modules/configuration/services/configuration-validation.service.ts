import { Injectable, Logger } from "@nestjs/common";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

export interface ConfigurationSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: any;
}

@Injectable()
export class ConfigurationValidationService {
  private readonly logger = new Logger(ConfigurationValidationService.name);
  private readonly ajv: Ajv;

  // Built-in validation schemas for common configuration types
  private readonly builtInSchemas: Record<string, ConfigurationSchema> = {
    string: {
      type: "string",
    },
    number: {
      type: "number",
    },
    boolean: {
      type: "boolean",
    },
    email: {
      type: "string",
      format: "email",
    },
    url: {
      type: "string",
      format: "uri",
    },
    port: {
      type: "number",
      minimum: 1,
      maximum: 65535,
    },
    database_config: {
      type: "object",
      properties: {
        host: { type: "string" },
        port: { type: "number", minimum: 1, maximum: 65535 },
        username: { type: "string" },
        password: { type: "string" },
        database: { type: "string" },
      },
      required: ["host", "port", "username", "database"],
      additionalProperties: false,
    },
    redis_config: {
      type: "object",
      properties: {
        host: { type: "string" },
        port: { type: "number", minimum: 1, maximum: 65535 },
        password: { type: "string" },
        db: { type: "number", minimum: 0 },
      },
      required: ["host", "port"],
      additionalProperties: false,
    },
    jwt_config: {
      type: "object",
      properties: {
        secret: { type: "string", minLength: 32 },
        expiresIn: { type: "string" },
        issuer: { type: "string" },
        audience: { type: "string" },
      },
      required: ["secret"],
      additionalProperties: false,
    },
    rate_limit_config: {
      type: "object",
      properties: {
        windowMs: { type: "number", minimum: 1000 },
        max: { type: "number", minimum: 1 },
        message: { type: "string" },
      },
      required: ["windowMs", "max"],
      additionalProperties: false,
    },
  };

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
    this.registerBuiltInSchemas();
  }

  /**
   * Validate a configuration value against a schema
   */
  async validateValue(value: string, schemaName?: string): Promise<ValidationResult> {
    try {
      if (!schemaName) {
        return { isValid: true };
      }

      const schema = this.getSchema(schemaName);
      if (!schema) {
        this.logger.warn(`Schema '${schemaName}' not found, skipping validation`);
        return { isValid: true };
      }

      let parsedValue: any;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // If not JSON, treat as string
        parsedValue = value;
      }

      const validate = this.ajv.compile(schema);
      const isValid = validate(parsedValue);

      if (!isValid) {
        const errors =
          validate.errors?.map((error) => `${error.instancePath || "root"}: ${error.message}`) ||
          [];

        return {
          isValid: false,
          errors,
        };
      }

      return { isValid: true };
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`, error.stack);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
      };
    }
  }

  /**
   * Validate multiple configurations
   */
  async validateConfigurations(
    configurations: Array<{
      key: string;
      value: string;
      validationSchema?: string;
    }>,
  ): Promise<Record<string, ValidationResult>> {
    const results: Record<string, ValidationResult> = {};

    for (const config of configurations) {
      results[config.key] = await this.validateValue(config.value, config.validationSchema);
    }

    return results;
  }

  /**
   * Register a custom validation schema
   */
  registerSchema(name: string, schema: ConfigurationSchema): void {
    try {
      this.ajv.addSchema(schema, name);
      this.logger.debug(`Registered custom schema: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to register schema '${name}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available schema names
   */
  getAvailableSchemas(): string[] {
    return Object.keys(this.builtInSchemas);
  }

  /**
   * Get schema by name
   */
  private getSchema(name: string): ConfigurationSchema | null {
    // Check built-in schemas first
    if (this.builtInSchemas[name]) {
      return this.builtInSchemas[name];
    }

    // Check registered schemas
    const schema = this.ajv.getSchema(name);
    return (schema?.schema as ConfigurationSchema) || null;
  }

  /**
   * Register built-in schemas
   */
  private registerBuiltInSchemas(): void {
    for (const [name, schema] of Object.entries(this.builtInSchemas)) {
      try {
        this.ajv.addSchema(schema, name);
      } catch (error) {
        this.logger.error(`Failed to register built-in schema '${name}': ${error.message}`);
      }
    }
  }

  /**
   * Validate environment-specific configuration requirements
   */
  async validateEnvironmentConfig(
    environment: string,
    configurations: Record<string, string>,
  ): Promise<ValidationResult> {
    const requiredConfigs = this.getRequiredConfigsForEnvironment(environment);
    const missing: string[] = [];

    for (const requiredKey of requiredConfigs) {
      if (!configurations[requiredKey]) {
        missing.push(requiredKey);
      }
    }

    if (missing.length > 0) {
      return {
        isValid: false,
        errors: [`Missing required configurations for ${environment}: ${missing.join(", ")}`],
      };
    }

    return { isValid: true };
  }

  /**
   * Get required configurations for an environment
   */
  private getRequiredConfigsForEnvironment(environment: string): string[] {
    const baseRequired = [
      "DATABASE_HOST",
      "DATABASE_PORT",
      "DATABASE_USERNAME",
      "DATABASE_NAME",
      "JWT_AUTH_SECRET",
      "JWT_REFRESH_SECRET",
    ];

    switch (environment) {
      case "production":
        return [...baseRequired, "REDIS_HOST", "REDIS_PORT", "ENCRYPTION_KEY_V1", "SESSION_SECRET"];
      case "staging":
        return [...baseRequired, "REDIS_HOST", "REDIS_PORT"];
      case "development":
      case "test":
      default:
        return baseRequired;
    }
  }
}
