import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api/v1';

  // Database Configuration (required)
  @IsString()
  DATABASE_URL: string;

  // Redis Configuration (optional - can use individual components)
  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // JWT Configuration (required)
  @IsString()
  @MinLength(32, {
    message: 'JWT_AUTH_SECRET must be at least 32 characters long for security',
  })
  JWT_AUTH_SECRET: string;

  @IsString()
  @MinLength(32, {
    message:
      'JWT_REFRESH_SECRET must be at least 32 characters long for security',
  })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '24h';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '30d';

  // Logging Configuration
  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsString()
  @IsOptional()
  LOG_DIR?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  // Encryption Configuration (required for production)
  @IsString()
  @MinLength(32, {
    message: 'PROVIDER_ENCRYPTION_KEY must be at least 32 characters long',
  })
  PROVIDER_ENCRYPTION_KEY: string;

  @IsString()
  @IsOptional()
  ENCRYPTION_KEY_VERSION?: string;

  @IsString()
  @IsOptional()
  ENCRYPTION_KEY_VERSIONS?: string;

  // Session Security (required for production)
  @IsString()
  @MinLength(32, {
    message: 'SESSION_SECRET must be at least 32 characters long for security',
  })
  SESSION_SECRET: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  SESSION_TIMEOUT?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  MAX_SESSIONS_PER_USER?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  ENFORCE_SESSION_IP?: boolean;

  // Rate Limiting Configuration
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  DEFAULT_RATE_LIMIT?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  RATE_LIMIT_WINDOW?: number;

  // OAuth Configuration (optional)
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GITHUB_CALLBACK_URL?: string;

  // Voice Configuration (optional)
  @IsString()
  @IsOptional()
  VOICE_PROVIDER?: string;

  // Twilio Configuration (optional)
  @IsString()
  @IsOptional()
  TWILIO_ACCOUNT_SID?: string;

  @IsString()
  @IsOptional()
  TWILIO_AUTH_TOKEN?: string;

  @IsString()
  @IsOptional()
  TWILIO_PHONE_NUMBER?: string;

  @IsString()
  @IsOptional()
  TWILIO_WEBHOOK_URL?: string;

  // Voice OTP Configuration
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  VOICE_OTP_ENABLED?: boolean;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  VOICE_OTP_DEFAULT_REPEAT_COUNT?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  VOICE_OTP_MAX_REPEAT_COUNT?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  VOICE_OTP_REPEAT_DELAY?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  VOICE_OTP_CALL_TIMEOUT?: number;

  @IsString()
  @IsOptional()
  VOICE_OTP_DEFAULT_LANGUAGE?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  VOICE_OTP_VOICE_SPEED?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  VOICE_OTP_VOICE_PITCH?: number;

  // Socket.IO Configuration
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  SOCKETIO_ENABLED?: boolean;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  SOCKETIO_PORT?: number;

  @IsString()
  @IsOptional()
  SOCKETIO_CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  SOCKETIO_TRANSPORTS?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  SOCKETIO_PING_TIMEOUT?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  SOCKETIO_PING_INTERVAL?: number;

  @IsString()
  @IsOptional()
  SOCKETIO_ADAPTER?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  SOCKETIO_CLUSTER_ENABLED?: boolean;

  // Webhook Configuration
  @IsString()
  @IsOptional()
  WEBHOOK_URL?: string;

  @IsString()
  @IsOptional()
  WEBHOOK_SECRET?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  WEBHOOK_RETRY_ATTEMPTS?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  WEBHOOK_TIMEOUT?: number;

  // Circuit Breaker Configuration
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  CIRCUIT_BREAKER_FAILURE_THRESHOLD?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  CIRCUIT_BREAKER_RESET_TIMEOUT?: number;

  // Provider Configuration
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  PROVIDER_BULK_BATCH_SIZE?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  PROVIDER_MIN_SUCCESS_RATE?: number;

  // Health Check Configuration
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  HEALTH_CHECK_INTERVAL?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  HEALTH_THRESHOLD?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  ALERT_THRESHOLD?: number;

  // Alert System Configuration
  @IsString()
  @IsOptional()
  SLACK_BOT_TOKEN?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  SLACK_ALERTS_ENABLED?: boolean;

  @IsString()
  @IsOptional()
  SLACK_ALERT_CHANNEL?: string;

  @IsString()
  @IsOptional()
  DISCORD_BOT_TOKEN?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  DISCORD_ALERTS_ENABLED?: boolean;

  @IsString()
  @IsOptional()
  DISCORD_ALERT_CHANNEL_ID?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
