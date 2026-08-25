import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  validateSync,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from "class-validator";
import { Transform, plainToClass } from "class-transformer";

enum NodeEnvironment {
  DEVELOPMENT = "development",
  PRODUCTION = "production",
  TEST = "test",
}

@ValidatorConstraint({ name: "isDatabaseUrl", async: false })
export class IsDatabaseUrlConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value) return true; // Optional field

    // Remove quotes if present
    const cleanValue = value.replace(/^["']|["']$/g, "");

    // Check if it's a valid database URL format
    try {
      const url = new URL(cleanValue);
      // Allow common database protocols
      const validProtocols = [
        "postgres:",
        "postgresql:",
        "mysql:",
        "mysql2:",
        "mariadb:",
        "sqlite:",
        "mongodb:",
        "redis:",
        "rediss:",
        "mssql:",
      ];
      return validProtocols.includes(url.protocol);
    } catch {
      // If URL parsing fails, it might still be a valid connection string
      // Allow basic patterns like host:port or more complex connection strings
      return cleanValue.length > 0 && typeof cleanValue === "string";
    }
  }

  defaultMessage(): string {
    return "DATABASE_URL must be a valid database connection string";
  }
}

@ValidatorConstraint({ name: "isRedisUrl", async: false })
export class IsRedisUrlConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!value) return true; // Optional field

    // Remove quotes if present
    const cleanValue = value.replace(/^["']|["']$/g, "");

    // Check if it's a valid Redis URL format
    try {
      const url = new URL(cleanValue);
      return ["redis:", "rediss:"].includes(url.protocol);
    } catch {
      // If URL parsing fails, it might still be a valid connection string
      // Allow basic patterns like host:port or more complex connection strings
      return cleanValue.length > 0 && typeof cleanValue === "string";
    }
  }

  defaultMessage(): string {
    return "REDIS_URL must be a valid Redis connection string";
  }
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.DEVELOPMENT;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3000;

  @IsString()
  API_PREFIX: string = "api/v1";

  // Database Configuration
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  DATABASE_HOST?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  DATABASE_PORT?: number;

  @IsOptional()
  @IsString()
  DATABASE_USERNAME?: string;

  @IsOptional()
  @IsString()
  DATABASE_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DATABASE_NAME?: string;

  // Redis Configuration
  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT?: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_DB?: number;

  // JWT Configuration
  @IsString()
  JWT_AUTH_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string = "24h";

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string = "30d";

  // Session Configuration
  @IsString()
  SESSION_SECRET: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  SESSION_TIMEOUT?: number = 3600000;

  // Encryption Configuration
  @IsString()
  PROVIDER_ENCRYPTION_KEY: string;

  @IsOptional()
  @IsString()
  ENCRYPTION_KEY_VERSION?: string = "v1";

  // Rate Limiting
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  DEFAULT_RATE_LIMIT?: number = 100;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  RATE_LIMIT_WINDOW?: number = 60;

  // Alert Configuration
  @IsOptional()
  @IsString()
  SLACK_BOT_TOKEN?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  SLACK_ALERTS_ENABLED?: boolean = false;

  @IsOptional()
  @IsString()
  SLACK_ALERT_CHANNEL?: string = "#alerts";

  @IsOptional()
  @IsString()
  DISCORD_BOT_TOKEN?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  DISCORD_ALERTS_ENABLED?: boolean = false;

  @IsOptional()
  @IsString()
  DISCORD_ALERT_CHANNEL_ID?: string;

  // Logging
  @IsOptional()
  @IsString()
  LOG_LEVEL?: string = "info";

  @IsOptional()
  @IsString()
  LOG_DIR?: string = "logs";

  // Performance Configuration
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  BATCH_MAX_SIZE?: number = 100;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  BATCH_MAX_WAIT_TIME?: number = 5000;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  BATCH_MAX_CONCURRENCY?: number = 10;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  HTTP_POOL_MAX_SOCKETS?: number = 50;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  HTTP_POOL_MAX_FREE_SOCKETS?: number = 10;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  HTTP_POOL_TIMEOUT?: number = 30000;

  // Memory Optimization
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  MEMORY_HEAP_WARNING_MB?: number = 512;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  MEMORY_HEAP_CRITICAL_MB?: number = 1024;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  MEMORY_RSS_WARNING_MB?: number = 1024;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  MEMORY_RSS_CRITICAL_MB?: number = 2048;

  // Cache Configuration
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  CACHE_DEFAULT_TTL?: number = 300;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  CACHE_TEMPLATE_TTL?: number = 3600;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  CACHE_TENANT_TTL?: number = 1800;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      const constraints = error.constraints ? Object.values(error.constraints) : [];
      return `${error.property}: ${constraints.join(", ")}`;
    });

    throw new Error(`Environment validation failed:\n${errorMessages.join("\n")}`);
  }

  return validatedConfig;
}
