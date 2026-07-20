import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { NotificationChannel } from '../../../common/enums/notification-channel.enum';

export class ProviderRequirementsDto {
  @ApiProperty({
    description: 'Notification channel type',
    enum: NotificationChannel,
    example: NotificationChannel.SMS,
  })
  @IsEnum(NotificationChannel, { message: 'Channel must be a valid notification channel' })
  channel: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Geographic region for provider',
    example: 'us-east-1',
  })
  @IsOptional()
  @IsString({ message: 'Region must be a string' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  region?: string;

  @ApiPropertyOptional({
    description: 'Monthly budget in USD',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Budget must be a number' })
  @Min(0, { message: 'Budget must be greater than or equal to 0' })
  budget?: number;

  @ApiPropertyOptional({
    description: 'Expected monthly message volume',
    example: 100000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Volume must be a number' })
  @Min(0, { message: 'Volume must be greater than or equal to 0' })
  volume?: number;

  @ApiPropertyOptional({
    description: 'Required provider features',
    type: [String],
    example: ['two-way-messaging', 'delivery-reports'],
  })
  @IsOptional()
  @IsArray({ message: 'Features must be an array' })
  @IsString({ each: true, message: 'Each feature must be a string' })
  features?: string[];
}

export class CalculateCostDto {
  @ApiProperty({
    description: 'Provider template ID',
    example: 'template-twilio-sms',
  })
  @IsString({ message: 'Template ID must be a string' })
  templateId: string;

  @ApiProperty({
    description: 'Number of messages to calculate cost for',
    example: 10000,
    minimum: 1,
  })
  @IsNumber({}, { message: 'Message count must be a number' })
  @Min(1, { message: 'Message count must be at least 1' })
  messageCount: number;

  @ApiPropertyOptional({
    description: 'Additional metadata for cost calculation',
    example: { region: 'us-east-1', priority: 'high' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: Record<string, any>;
}

export class BulkProviderSetupDto {
  @ApiProperty({
    description: 'Provider template ID',
    example: 'template-twilio-sms',
  })
  @IsString({ message: 'Template ID must be a string' })
  templateId: string;

  @ApiProperty({
    description: 'Provider configuration object',
    example: { apiKey: 'key123', apiSecret: 'secret456' },
  })
  @IsObject({ message: 'Config must be an object' })
  config: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Provider priority (lower number = higher priority)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Priority must be a number' })
  @Min(1, { message: 'Priority must be at least 1' })
  priority?: number;

  @ApiPropertyOptional({
    description: 'Whether this is the default provider for the channel',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'isDefault must be a boolean' })
  isDefault?: boolean;
}

export class BulkSetupRequestDto {
  @ApiProperty({
    description: 'Project ID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'Project ID must be a valid UUID' })
  projectId: string;

  @ApiProperty({
    description: 'List of providers to set up',
    type: [BulkProviderSetupDto],
  })
  @IsArray({ message: 'Providers must be an array' })
  @ValidateNested({ each: true })
  @Type(() => BulkProviderSetupDto)
  providers: BulkProviderSetupDto[];
}

export class CostAnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by notification channel',
    enum: NotificationChannel,
    example: NotificationChannel.SMS,
  })
  @IsOptional()
  @IsEnum(NotificationChannel, { message: 'Channel must be a valid notification channel' })
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Start date for analytics (ISO 8601 format)',
    example: '2024-12-01T00:00:00Z',
  })
  @IsOptional()
  @IsString({ message: 'Start date must be a string' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics (ISO 8601 format)',
    example: '2024-12-17T23:59:59Z',
  })
  @IsOptional()
  @IsString({ message: 'End date must be a string' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Time granularity for data aggregation',
    enum: ['hour', 'day', 'week', 'month'],
    default: 'day',
    example: 'day',
  })
  @IsOptional()
  @IsEnum(['hour', 'day', 'week', 'month'], { message: 'Granularity must be hour, day, week, or month' })
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export class CostAlertsQueryDto {
  @ApiPropertyOptional({
    description: 'Daily cost limit in USD',
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Daily limit must be a number' })
  @Min(0, { message: 'Daily limit must be greater than or equal to 0' })
  dailyLimit?: number;

  @ApiPropertyOptional({
    description: 'Monthly cost limit in USD',
    example: 2000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Monthly limit must be a number' })
  @Min(0, { message: 'Monthly limit must be greater than or equal to 0' })
  monthlyLimit?: number;

  @ApiPropertyOptional({
    description: 'Spike threshold percentage (0-100)',
    example: 50,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Spike threshold must be a number' })
  @Min(0, { message: 'Spike threshold must be at least 0' })
  @Max(100, { message: 'Spike threshold must not exceed 100' })
  spikeThreshold?: number;
}

export class ProviderTemplateQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by notification channel',
    enum: NotificationChannel,
    example: NotificationChannel.SMS,
  })
  @IsOptional()
  @IsEnum(NotificationChannel, { message: 'Channel must be a valid notification channel' })
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Search templates by name or description',
    example: 'twilio',
  })
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter to show only popular templates',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Popular must be a boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  popular?: boolean;
}

// Response DTOs
export class ProviderTemplateResponseDto {
  @ApiProperty({
    description: 'Template ID',
    example: 'template-twilio-sms',
  })
  id: string;

  @ApiProperty({
    description: 'Template name',
    example: 'Twilio SMS',
  })
  name: string;

  @ApiProperty({
    description: 'Provider ID',
    example: 'twilio',
  })
  providerId: string;

  @ApiProperty({
    description: 'Notification channel',
    example: 'sms',
  })
  channel: string;

  @ApiProperty({
    description: 'Template description',
    example: 'Send SMS messages via Twilio',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Provider logo URL',
    example: 'https://example.com/logo.png',
  })
  logoUrl?: string;

  @ApiProperty({
    description: 'Setup difficulty level',
    enum: ['easy', 'medium', 'hard'],
    example: 'easy',
  })
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty({
    description: 'Supported features',
    type: [String],
    example: ['two-way-messaging', 'delivery-reports', 'scheduling'],
  })
  supportedFeatures: string[];

  @ApiPropertyOptional({
    description: 'Supported geographic regions',
    type: [String],
    example: ['us-east-1', 'eu-west-1'],
  })
  regions?: string[];

  @ApiPropertyOptional({
    description: 'Whether this is a popular template',
    example: true,
  })
  isPopular?: boolean;

  @ApiProperty({
    description: 'Setup instructions',
    example: '1. Create Twilio account\n2. Get API credentials\n3. Configure in dashboard',
  })
  setupInstructions: string;

  @ApiPropertyOptional({
    description: 'Cost model information',
    example: {
      type: 'per-message',
      baseRate: 0.0075,
      currency: 'USD',
      infrastructureFee: 1.0,
    },
  })
  costModel?: {
    type: string;
    baseRate: number;
    currency: string;
    infrastructureFee?: number;
  };
}

export class ValidationResultDto {
  @ApiProperty({
    description: 'Whether configuration is valid',
    example: true,
  })
  isValid: boolean;

  @ApiProperty({
    description: 'List of validation errors',
    type: [String],
    example: ['API key is required', 'Invalid region'],
  })
  errors: string[];
}

export class ConfigurationHintDto {
  @ApiProperty({
    description: 'Configuration property name',
    example: 'apiKey',
  })
  property: string;

  @ApiProperty({
    description: 'Hint for configuring this property',
    example: 'Your API key can be found in the Twilio dashboard',
  })
  hint: string;

  @ApiPropertyOptional({
    description: 'Example value for this property',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  example?: any;
}

export class CostCalculationResultDto {
  @ApiProperty({
    description: 'Total estimated cost',
    example: 75.50,
  })
  totalCost: number;

  @ApiProperty({
    description: 'Provider cost',
    example: 75.00,
  })
  providerCost: number;

  @ApiProperty({
    description: 'Infrastructure cost',
    example: 0.50,
  })
  infrastructureCost: number;

  @ApiProperty({
    description: 'Cost breakdown',
    example: {
      base: 75.00,
      overage: 0,
      infrastructure: 0.50,
    },
  })
  breakdown: {
    base: number;
    overage: number;
    infrastructure: number;
  };

  @ApiPropertyOptional({
    description: 'Potential savings information',
    example: {
      amount: 10.00,
      percentage: 11.76,
      comparedTo: 'average-market-rate',
    },
  })
  savings?: {
    amount: number;
    percentage: number;
    comparedTo: string;
  };
}

export class TimeSeriesDataDto {
  @ApiProperty({
    description: 'Data point timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Data point value',
    example: 150.75,
  })
  value: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { provider: 'twilio', channel: 'sms' },
  })
  metadata?: Record<string, any>;
}

export class CostTrendsResponseDto {
  @ApiProperty({
    description: 'Time series data points',
    type: [TimeSeriesDataDto],
  })
  trends: TimeSeriesDataDto[];

  @ApiProperty({
    description: 'Analysis period',
    example: {
      start: '2024-12-01T00:00:00Z',
      end: '2024-12-17T23:59:59Z',
    },
  })
  period: {
    start: Date;
    end: Date;
  };

  @ApiProperty({
    description: 'Data granularity',
    example: 'day',
  })
  granularity: string;
}

export class ProviderComparisonDto {
  @ApiProperty({
    description: 'Provider ID',
    example: 'twilio',
  })
  providerId: string;

  @ApiProperty({
    description: 'Provider name',
    example: 'Twilio',
  })
  providerName: string;

  @ApiProperty({
    description: 'Total cost for period',
    example: 500.00,
  })
  totalCost: number;

  @ApiProperty({
    description: 'Total messages sent',
    example: 100000,
  })
  messageCount: number;

  @ApiProperty({
    description: 'Cost per message',
    example: 0.005,
  })
  costPerMessage: number;

  @ApiProperty({
    description: 'Delivery success rate (0-100)',
    example: 99.5,
  })
  deliveryRate: number;
}

export class ProviderComparisonResponseDto {
  @ApiProperty({
    description: 'Provider comparison data',
    type: [ProviderComparisonDto],
  })
  providers: ProviderComparisonDto[];

  @ApiProperty({
    description: 'Recommendations based on comparison',
    type: [String],
    example: ['Consider switching to Provider B for better rates', 'Provider A has better delivery rates'],
  })
  recommendations: string[];
}

export class CostAlertDto {
  @ApiProperty({
    description: 'Alert type',
    enum: ['threshold_exceeded', 'budget_warning', 'unusual_spike', 'cost_optimization'],
    example: 'threshold_exceeded',
  })
  type: 'threshold_exceeded' | 'budget_warning' | 'unusual_spike' | 'cost_optimization';

  @ApiProperty({
    description: 'Alert severity level',
    enum: ['info', 'warning', 'critical'],
    example: 'warning',
  })
  severity: 'info' | 'warning' | 'critical';

  @ApiProperty({
    description: 'Alert message',
    example: 'Daily cost limit exceeded',
  })
  message: string;

  @ApiProperty({
    description: 'Current cost',
    example: 150.00,
  })
  currentCost: number;

  @ApiPropertyOptional({
    description: 'Threshold that was exceeded',
    example: 100.00,
  })
  threshold?: number;

  @ApiPropertyOptional({
    description: 'Recommended actions',
    type: [String],
    example: ['Review provider configuration', 'Consider volume discounts'],
  })
  recommendations?: string[];
}

export class OptimizationRecommendationDto {
  @ApiProperty({
    description: 'Recommendation type',
    enum: ['provider_switch', 'volume_optimization', 'timing_optimization', 'configuration_change'],
    example: 'provider_switch',
  })
  type: 'provider_switch' | 'volume_optimization' | 'timing_optimization' | 'configuration_change';

  @ApiProperty({
    description: 'Recommendation title',
    example: 'Switch to Provider B',
  })
  title: string;

  @ApiProperty({
    description: 'Detailed description',
    example: 'Provider B offers better rates for your volume',
  })
  description: string;

  @ApiProperty({
    description: 'Estimated monthly savings in USD',
    example: 250.00,
  })
  estimatedSavings: number;

  @ApiProperty({
    description: 'Implementation effort level',
    enum: ['low', 'medium', 'high'],
    example: 'medium',
  })
  effort: 'low' | 'medium' | 'high';

  @ApiProperty({
    description: 'Expected impact level',
    enum: ['low', 'medium', 'high'],
    example: 'high',
  })
  impact: 'low' | 'medium' | 'high';
}

export class CostOptimizationResponseDto {
  @ApiProperty({
    description: 'List of optimization recommendations',
    type: [OptimizationRecommendationDto],
  })
  recommendations: OptimizationRecommendationDto[];

  @ApiProperty({
    description: 'Total potential monthly savings',
    example: 500.00,
  })
  totalPotentialSavings: number;
}

export class ProviderHealthDto {
  @ApiProperty({
    description: 'Provider ID',
    example: 'twilio',
  })
  providerId: string;

  @ApiProperty({
    description: 'Provider name',
    example: 'Twilio',
  })
  providerName: string;

  @ApiProperty({
    description: 'Notification channel',
    example: 'sms',
  })
  channel: string;

  @ApiProperty({
    description: 'Provider health status',
    enum: ['healthy', 'degraded', 'unhealthy'],
    example: 'healthy',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Last health check timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  lastCheck?: Date;

  @ApiPropertyOptional({
    description: 'Response time in milliseconds',
    example: 150,
  })
  responseTime?: number;

  @ApiPropertyOptional({
    description: 'Error message if unhealthy',
    example: 'Connection timeout',
  })
  error?: string;
}

export class HealthOverviewResponseDto {
  @ApiProperty({
    description: 'Health summary statistics',
    example: {
      totalProviders: 5,
      healthyProviders: 4,
      unhealthyProviders: 1,
      healthPercentage: 80,
    },
  })
  summary: {
    totalProviders: number;
    healthyProviders: number;
    unhealthyProviders: number;
    healthPercentage: number;
  };

  @ApiProperty({
    description: 'Individual provider health status',
    type: [ProviderHealthDto],
  })
  providers: ProviderHealthDto[];
}

export class SetupGuideResponseDto {
  @ApiProperty({
    description: 'Notification channel',
    example: 'sms',
  })
  channel: string;

  @ApiProperty({
    description: 'Number of available providers',
    example: 5,
  })
  availableProviders: number;

  @ApiProperty({
    description: 'Popular provider templates',
    type: [ProviderTemplateResponseDto],
  })
  popularProviders: ProviderTemplateResponseDto[];

  @ApiProperty({
    description: 'Easy to setup provider templates',
    type: [ProviderTemplateResponseDto],
  })
  easySetupProviders: ProviderTemplateResponseDto[];

  @ApiProperty({
    description: 'Setup steps',
    type: [String],
    example: [
      'Choose a provider',
      'Create account',
      'Get API credentials',
      'Configure in dashboard',
      'Test configuration',
      'Go live',
    ],
  })
  setupSteps: string[];

  @ApiProperty({
    description: 'Important considerations',
    type: [String],
    example: [
      'Cost per message',
      'Delivery reliability',
      'Geographic coverage',
      'Feature support',
      'Setup complexity',
    ],
  })
  considerations: string[];
}

export class BulkSetupResultDto {
  @ApiPropertyOptional({
    description: 'Template ID',
    example: 'template-twilio-sms',
  })
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Provider ID',
    example: 'twilio',
  })
  providerId?: string;

  @ApiPropertyOptional({
    description: 'Configuration ID',
    example: 'config-123',
  })
  configId?: string;

  @ApiProperty({
    description: 'Setup result status',
    enum: ['success', 'error'],
    example: 'success',
  })
  status: 'success' | 'error';

  @ApiPropertyOptional({
    description: 'Error message if setup failed',
    example: 'Invalid API credentials',
  })
  error?: string;
}

export class BulkSetupResponseDto {
  @ApiProperty({
    description: 'Setup summary',
    example: {
      total: 3,
      successful: 2,
      failed: 1,
    },
  })
  summary: {
    total: number;
    successful: number;
    failed: number;
  };

  @ApiProperty({
    description: 'Individual setup results',
    type: [BulkSetupResultDto],
  })
  results: BulkSetupResultDto[];
}