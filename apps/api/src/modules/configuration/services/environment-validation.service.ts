import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ValidationError {
  variable: string;
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

@Injectable()
export class EnvironmentValidationService {
  private readonly logger = new Logger(EnvironmentValidationService.name);

  constructor(private readonly configService: ConfigService) { }

  /**
   * Validates all environment variables and returns validation errors
   */
  validateEnvironment(): ValidationError[] {
    const errors: ValidationError[] = [];

    // Core required variables
    errors.push(...this.validateCoreVariables());

    // Security variables
    errors.push(...this.validateSecurityVariables());

    // Database and Redis
    errors.push(...this.validateDatabaseVariables());

    // OAuth configuration (if enabled)
    errors.push(...this.validateOAuthVariables());



    // Twilio (if enabled)
    errors.push(...this.validateTwilioVariables());

    // Alert system (if enabled)
    errors.push(...this.validateAlertVariables());

    return errors;
  }

  /**
   * Validates environment and throws error if critical issues found
   */
  validateOrThrow(): void {
    const errors = this.validateEnvironment();
    const criticalErrors = errors.filter((error) => error.severity === 'error');

    if (criticalErrors.length > 0) {
      // Use console.error to ensure immediate output
      console.error('\n' + '='.repeat(80));
      console.error('ENVIRONMENT VALIDATION FAILED');
      console.error('='.repeat(80));
      console.error(`Found ${criticalErrors.length} critical error(s):\n`);
      
      criticalErrors.forEach((error, index) => {
        console.error(`${index + 1}. Variable: ${error.variable}`);
        console.error(`   Error: ${error.message}`);
        if (error.suggestion) {
          console.error(`   Fix: ${error.suggestion}`);
        }
        console.error('');
      });
      
      console.error('='.repeat(80));
      console.error('Please fix the above environment variables and restart the application.');
      console.error('='.repeat(80) + '\n');

      throw new Error(
        `Environment validation failed with ${criticalErrors.length} critical error(s). ` +
        'Please check the detailed logs above for specific fixes needed.',
      );
    }

    const warnings = errors.filter((error) => error.severity === 'warning');
    if (warnings.length > 0) {
      this.logger.warn('Environment validation warnings:');
      warnings.forEach((warning) => {
        this.logger.warn(`- ${warning.variable}: ${warning.message}`);
        if (warning.suggestion) {
          this.logger.warn(`  Suggestion: ${warning.suggestion}`);
        }
      });
    }
  }

  private validateCoreVariables(): ValidationError[] {
    const errors: ValidationError[] = [];

    // Database URL is required
    if (!this.configService.get<string>('DATABASE_URL')) {
      errors.push({
        variable: 'DATABASE_URL',
        message: 'Database URL is required',
        severity: 'error',
        suggestion:
          'Set DATABASE_URL=postgres://username:password@localhost:5432/database_name',
      });
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    errors.push(
      ...this.validateJwtSecret('JWT_AUTH_SECRET', 'access tokens', nodeEnv),
      ...this.validateJwtSecret(
        'JWT_REFRESH_SECRET',
        'refresh tokens',
        nodeEnv,
      ),
    );

    return errors;
  }

  private validateJwtSecret(
    variable: string,
    purpose: string,
    nodeEnv: string,
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const secret = this.configService.get<string>(variable);

    if (!secret) {
      errors.push({
        variable,
        message: `${variable} is required for ${purpose}`,
        severity: 'error',
        suggestion:
          'Generate a secure random string at least 32 characters long',
      });
      return errors;
    }

    if (secret.length < 32) {
      errors.push({
        variable,
        message: `${variable} should be at least 32 characters long for security`,
        severity: 'warning',
        suggestion: 'Use a longer, more secure secret key',
      });
    }

    if (
      secret.includes('change-in-production') ||
      secret.includes('default-secret') ||
      secret.includes('change-me')
    ) {
      errors.push({
        variable,
        message: `${variable} is using a default value`,
        severity: 'error',
        suggestion: 'Change from default value to a secure random string',
      });
    }

    if (nodeEnv === 'production' && secret.length < 64) {
      errors.push({
        variable,
        message: `${variable} should be at least 64 characters in production`,
        severity: 'error',
        suggestion: 'Use a longer, more secure secret key for production',
      });
    }

    return errors;
  }

  private validateSecurityVariables(): ValidationError[] {
    const errors: ValidationError[] = [];
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // Encryption key validation
    const encryptionKey = this.configService.get<string>(
      'PROVIDER_ENCRYPTION_KEY',
    );
    if (!encryptionKey) {
      errors.push({
        variable: 'PROVIDER_ENCRYPTION_KEY',
        message: 'Provider encryption key is required',
        severity: 'error',
        suggestion: 'Generate a secure 32-character encryption key',
      });
    } else if (encryptionKey.length < 32) {
      errors.push({
        variable: 'PROVIDER_ENCRYPTION_KEY',
        message: 'Encryption key should be at least 32 characters long',
        severity: 'warning',
        suggestion: 'Use a longer encryption key for better security',
      });
    } else if (
      encryptionKey === 'your-32-character-encryption-key-change-in-production'
    ) {
      errors.push({
        variable: 'PROVIDER_ENCRYPTION_KEY',
        message: 'Encryption key is using default value',
        severity: 'error',
        suggestion: 'Change from default value to a secure random key',
      });
    }

    // Production-specific encryption key validation
    if (nodeEnv === 'production' && encryptionKey && encryptionKey.length < 32) {
      errors.push({
        variable: 'PROVIDER_ENCRYPTION_KEY',
        message: 'Encryption key must be at least 32 characters in production',
        severity: 'error',
        suggestion: 'Use a 32+ character encryption key for production',
      });
    }
    
    // Session secret validation
    const sessionSecret = this.configService.get<string>('SESSION_SECRET');
    if (!sessionSecret) {
      errors.push({
        variable: 'SESSION_SECRET',
        message: 'Session secret is required',
        severity: 'error',
        suggestion:
          'Generate a secure random string at least 32 characters long',
      });
    } else if (sessionSecret.length < 32) {
      errors.push({
        variable: 'SESSION_SECRET',
        message: 'Session secret should be at least 32 characters long',
        severity: 'warning',
        suggestion: 'Use a longer session secret for better security',
      });
    } else if (sessionSecret === 'your-session-secret-change-in-production') {
      errors.push({
        variable: 'SESSION_SECRET',
        message: 'Session secret is using default value',
        severity: 'error',
        suggestion: 'Change from default value to a secure random string',
      });
    }

    // Production-specific validations
    if (nodeEnv === 'production') {
      if (!this.configService.get<string>('FRONTEND_URL')) {
        errors.push({
          variable: 'FRONTEND_URL',
          message: 'Frontend URL should be set in production',
          severity: 'warning',
          suggestion: 'Set FRONTEND_URL to your production frontend domain',
        });
      }
    }

    return errors;
  }

  private validateDatabaseVariables(): ValidationError[] {
    const errors: ValidationError[] = [];

    // Redis configuration validation
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST');

    if (!redisUrl && !redisHost) {
      errors.push({
        variable: 'REDIS_URL or REDIS_HOST',
        message: 'Redis configuration is required',
        severity: 'error',
        suggestion:
          'Set either REDIS_URL or individual REDIS_HOST, REDIS_PORT components',
      });
    }

    return errors;
  }

  private validateOAuthVariables(): ValidationError[] {
    const errors: ValidationError[] = [];

    // Google OAuth validation
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.configService.get<string>(
      'GOOGLE_CLIENT_SECRET',
    );

    if (googleClientId && !googleClientSecret) {
      errors.push({
        variable: 'GOOGLE_CLIENT_SECRET',
        message: 'Google client secret is required when client ID is provided',
        severity: 'error',
        suggestion: 'Set GOOGLE_CLIENT_SECRET or remove GOOGLE_CLIENT_ID',
      });
    }

    if (!googleClientId && googleClientSecret) {
      errors.push({
        variable: 'GOOGLE_CLIENT_ID',
        message: 'Google client ID is required when client secret is provided',
        severity: 'error',
        suggestion: 'Set GOOGLE_CLIENT_ID or remove GOOGLE_CLIENT_SECRET',
      });
    }

    // GitHub OAuth validation
    const githubClientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const githubClientSecret = this.configService.get<string>(
      'GITHUB_CLIENT_SECRET',
    );

    if (githubClientId && !githubClientSecret) {
      errors.push({
        variable: 'GITHUB_CLIENT_SECRET',
        message: 'GitHub client secret is required when client ID is provided',
        severity: 'error',
        suggestion: 'Set GITHUB_CLIENT_SECRET or remove GITHUB_CLIENT_ID',
      });
    }

    if (!githubClientId && githubClientSecret) {
      errors.push({
        variable: 'GITHUB_CLIENT_ID',
        message: 'GitHub client ID is required when client secret is provided',
        severity: 'error',
        suggestion: 'Set GITHUB_CLIENT_ID or remove GITHUB_CLIENT_SECRET',
      });
    }

    return errors;
  }



  private validateTwilioVariables(): ValidationError[] {
    const errors: ValidationError[] = [];

    const voiceProvider = this.configService.get<string>(
      'VOICE_PROVIDER',
      'livekit',
    );
    if (voiceProvider !== 'twilio') return errors;

    const twilioAccountSid =
      this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = this.configService.get<string>(
      'TWILIO_PHONE_NUMBER',
    );

    if (!twilioAccountSid) {
      errors.push({
        variable: 'TWILIO_ACCOUNT_SID',
        message:
          'Twilio Account SID is required when using Twilio voice provider',
        severity: 'error',
        suggestion: 'Set TWILIO_ACCOUNT_SID or change VOICE_PROVIDER',
      });
    }

    if (!twilioAuthToken) {
      errors.push({
        variable: 'TWILIO_AUTH_TOKEN',
        message:
          'Twilio Auth Token is required when using Twilio voice provider',
        severity: 'error',
        suggestion: 'Set TWILIO_AUTH_TOKEN or change VOICE_PROVIDER',
      });
    }

    if (!twilioPhoneNumber) {
      errors.push({
        variable: 'TWILIO_PHONE_NUMBER',
        message:
          'Twilio Phone Number is required when using Twilio voice provider',
        severity: 'error',
        suggestion: 'Set TWILIO_PHONE_NUMBER or change VOICE_PROVIDER',
      });
    }

    return errors;
  }

  private validateAlertVariables(): ValidationError[] {
    const errors: ValidationError[] = [];

    // Slack alerts validation
    const slackEnabled = this.configService.get<string>('SLACK_ALERTS_ENABLED', 'false');
    if (slackEnabled === 'true' && !this.configService.get<string>('SLACK_BOT_TOKEN')) {
      errors.push({
        variable: 'SLACK_BOT_TOKEN',
        message: 'Slack bot token is required when Slack alerts are enabled',
        severity: 'error',
        suggestion: 'Set SLACK_BOT_TOKEN or disable SLACK_ALERTS_ENABLED',
      });
    }

    // Discord alerts validation
    const discordEnabled = this.configService.get<string>('DISCORD_ALERTS_ENABLED', 'false');
    if (
      discordEnabled === 'true' &&
      !this.configService.get<string>('DISCORD_BOT_TOKEN')
    ) {
      errors.push({
        variable: 'DISCORD_BOT_TOKEN',
        message:
          'Discord bot token is required when Discord alerts are enabled',
        severity: 'error',
        suggestion: 'Set DISCORD_BOT_TOKEN or disable DISCORD_ALERTS_ENABLED',
      });
    }

    return errors;
  }
}
