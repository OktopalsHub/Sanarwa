import { Injectable, Logger } from "@nestjs/common";
import { Channel } from "../../providers/types";
import { ProviderConfig } from "./provider-config.entity";
import { buildProviderConfigSchemas } from "./provider-config-schemas";
import { ValidationResult } from "./provider-config-validator.types";
import { VALID_COUNTRY_CODES } from "./provider-valid-country-codes";

export type { ValidationResult, ProviderConfigSchema } from "./provider-config-validator.types";

@Injectable()
export class ProviderConfigValidator {
  private readonly logger = new Logger(ProviderConfigValidator.name);
  private readonly schemas = buildProviderConfigSchemas();

  async validate(config: ProviderConfig): Promise<boolean> {
    const result = await this.validateDetailed(config);
    return result.isValid;
  }

  async validateDetailed(config: ProviderConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!config.providerId) {
        errors.push("Provider ID is required");
      }

      if (!config.providerName) {
        errors.push("Provider name is required");
      }

      if (!config.channel) {
        errors.push("Channel is required");
      }

      if (!config.config || typeof config.config !== "object") {
        errors.push("Provider configuration object is required");
      }

      if (config.priority < 1) {
        errors.push("Priority must be greater than 0");
      }

      if (config.channel && config.config) {
        const channelValidation = await this.validateChannelConfig(
          config.channel as unknown as Channel,
          config.providerId,
          config.config,
        );
        errors.push(...channelValidation.errors);
        warnings.push(...channelValidation.warnings);
      }

      if (config.rateLimits) {
        const rateLimitValidation = this.validateRateLimits(config.rateLimits);
        errors.push(...rateLimitValidation.errors);
        warnings.push(...rateLimitValidation.warnings);
      }

      if (config.healthCheck) {
        const healthCheckValidation = this.validateHealthCheck(config.healthCheck);
        errors.push(...healthCheckValidation.errors);
        warnings.push(...healthCheckValidation.warnings);
      }

      if (config.supportedCountries) {
        const countriesValidation = this.validateSupportedCountries(config.supportedCountries);
        errors.push(...countriesValidation.errors);
        warnings.push(...countriesValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings,
      };
    }
  }

  private async validateChannelConfig(
    channel: Channel,
    providerId: string,
    config: Record<string, any>,
  ): Promise<ValidationResult> {
    const schemaKey = `${channel}:${providerId}`;
    const schema = this.schemas.get(schemaKey) || this.schemas.get(channel);

    if (!schema) {
      return {
        isValid: true,
        errors: [],
        warnings: [`No validation schema found for ${channel}:${providerId}`],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const field of schema.required) {
      if (!config[field]) {
        errors.push(`Required field '${field}' is missing`);
      }
    }

    for (const [field, validator] of Object.entries(schema.validation)) {
      if (config[field] !== undefined && !validator(config[field])) {
        errors.push(`Invalid value for field '${field}'`);
      }
    }

    const knownFields = [...schema.required, ...schema.optional];
    for (const field of Object.keys(config)) {
      if (!knownFields.includes(field)) {
        warnings.push(`Unknown field '${field}' in configuration`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateRateLimits(rateLimits: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof rateLimits !== "object") {
      errors.push("Rate limits must be an object");
      return { isValid: false, errors, warnings };
    }

    const validFields = [
      "requestsPerSecond",
      "requestsPerMinute",
      "requestsPerHour",
      "requestsPerDay",
    ];

    for (const [field, value] of Object.entries(rateLimits)) {
      if (!validFields.includes(field)) {
        warnings.push(`Unknown rate limit field: ${field}`);
        continue;
      }

      if (typeof value !== "number" || value <= 0) {
        errors.push(`Rate limit '${field}' must be a positive number`);
      }
    }

    if (rateLimits.requestsPerSecond && rateLimits.requestsPerMinute) {
      if (rateLimits.requestsPerSecond * 60 > rateLimits.requestsPerMinute) {
        warnings.push("Requests per second * 60 exceeds requests per minute limit");
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateHealthCheck(healthCheck: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof healthCheck !== "object") {
      errors.push("Health check configuration must be an object");
      return { isValid: false, errors, warnings };
    }

    if (healthCheck.url && typeof healthCheck.url !== "string") {
      errors.push("Health check URL must be a string");
    }

    if (
      healthCheck.interval &&
      (typeof healthCheck.interval !== "number" || healthCheck.interval <= 0)
    ) {
      errors.push("Health check interval must be a positive number");
    }

    if (
      healthCheck.timeout &&
      (typeof healthCheck.timeout !== "number" || healthCheck.timeout < 0)
    ) {
      errors.push("Health check timeout must be a non-negative number");
    }

    if (
      healthCheck.retries &&
      (typeof healthCheck.retries !== "number" || healthCheck.retries < 0)
    ) {
      errors.push("Health check retries must be a non-negative number");
    }

    if (
      healthCheck.timeout &&
      healthCheck.interval &&
      healthCheck.timeout >= healthCheck.interval
    ) {
      warnings.push("Health check timeout should be less than interval");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSupportedCountries(countries: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(countries)) {
      errors.push("Supported countries must be an array");
      return { isValid: false, errors, warnings };
    }

    for (const country of countries) {
      if (typeof country !== "string") {
        errors.push("Country codes must be strings");
        continue;
      }

      if (country.length !== 2) {
        warnings.push(`Country code '${country}' should be 2 characters (ISO 3166-1 alpha-2)`);
      }

      if (!VALID_COUNTRY_CODES.includes(country.toUpperCase())) {
        warnings.push(`Unknown country code: ${country}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
