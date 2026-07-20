import { IsString, IsOptional, IsEnum, IsObject, IsArray, IsUUID, IsBoolean, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CertificateType, CertificateStatus, CertificateEnvironment } from '../entities/push-certificate.entity';

export class IOSCertificateDataDto {
  @ApiProperty({
    description: 'Base64 encoded certificate data (.p12 or .pem)',
    example: 'MIIFXjCCA0agAwIBAgIUK7...',
  })
  @IsString({ message: 'Certificate data must be a string' })
  certificateData: string;

  @ApiPropertyOptional({
    description: 'Password for the certificate file',
    example: 'certificate-password',
  })
  @IsOptional()
  @IsString({ message: 'Certificate password must be a string' })
  certificatePassword?: string;

  @ApiProperty({
    description: 'iOS app bundle identifier',
    example: 'com.example.app',
  })
  @IsString({ message: 'Bundle ID must be a string' })
  bundleId: string;

  @ApiProperty({
    description: 'Apple Team ID',
    example: 'ABCD123456',
  })
  @IsString({ message: 'Team ID must be a string' })
  teamId: string;

  @ApiPropertyOptional({
    description: 'Key ID for token-based authentication',
    example: 'ABC123DEF456',
  })
  @IsOptional()
  @IsString({ message: 'Key ID must be a string' })
  keyId?: string;

  @ApiPropertyOptional({
    description: 'Private key for token-based authentication',
    example: 'MIGfMA0BgkqhkiG9w0BAQEFAANGAADf...',
  })
  @IsOptional()
  @IsString({ message: 'Private key must be a string' })
  privateKey?: string;
}

export class AndroidCertificateDataDto {
  @ApiProperty({
    description: 'Firebase service account key JSON content',
    example: '{"type":"service_account","project_id":"my-project",...}',
  })
  @IsString({ message: 'Service account key must be a string' })
  serviceAccountKey: string;

  @ApiProperty({
    description: 'Firebase project ID',
    example: 'my-firebase-project',
  })
  @IsString({ message: 'Project ID must be a string' })
  projectId: string;

  @ApiProperty({
    description: 'Android app package name',
    example: 'com.example.app',
  })
  @IsString({ message: 'Package name must be a string' })
  packageName: string;

  @ApiPropertyOptional({
    description: 'Legacy FCM server key (deprecated)',
    example: 'AAAA1234567:ABC...',
  })
  @IsOptional()
  @IsString({ message: 'Server key must be a string' })
  serverKey?: string;
}

export class CreatePushCertificateDto {
  @ApiProperty({
    description: 'Certificate name',
    example: 'Production iOS Certificate',
  })
  @IsString({ message: 'Name must be a string' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Certificate description',
    example: 'Main production certificate for iOS app',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Certificate type',
    enum: CertificateType,
    example: CertificateType.IOS,
  })
  @IsEnum(CertificateType, { message: 'Type must be a valid certificate type' })
  type: CertificateType;

  @ApiProperty({
    description: 'Certificate environment',
    enum: CertificateEnvironment,
    example: CertificateEnvironment.PRODUCTION,
  })
  @IsEnum(CertificateEnvironment, { message: 'Environment must be a valid environment' })
  environment: CertificateEnvironment;

  @ApiProperty({
    description: 'Certificate data (iOS or Android)',
    oneOf: [
      { $ref: '#/components/schemas/IOSCertificateDataDto' },
      { $ref: '#/components/schemas/AndroidCertificateDataDto' },
    ],
  })
  @IsObject({ message: 'Certificate data must be an object' })
  @ValidateNested()
  @Type(() => Object)
  certificateData: IOSCertificateDataDto | AndroidCertificateDataDto;

  @ApiPropertyOptional({
    description: 'List of allowed project IDs',
    type: [String],
    example: ['project-1', 'project-2'],
  })
  @IsOptional()
  @IsArray({ message: 'Allowed projects must be an array' })
  @IsString({ each: true, message: 'Each allowed project must be a string' })
  allowedProjects?: string[];

  @ApiPropertyOptional({
    description: 'Access control configuration',
    example: {
      allowedRoles: ['admin', 'developer'],
      allowedUsers: ['user-1'],
      ipWhitelist: ['192.168.1.0/24'],
    },
  })
  @IsOptional()
  @IsObject({ message: 'Access control must be an object' })
  accessControl?: {
    allowedRoles?: string[];
    allowedUsers?: string[];
    ipWhitelist?: string[];
  };

  @ApiPropertyOptional({
    description: 'Certificate rotation configuration',
    example: {
      autoRotate: true,
      rotationDaysBeforeExpiry: 30,
      notificationEmails: ['admin@example.com'],
      webhookUrl: 'https://example.com/webhook',
    },
  })
  @IsOptional()
  @IsObject({ message: 'Rotation config must be an object' })
  rotationConfig?: {
    autoRotate: boolean;
    rotationDaysBeforeExpiry: number;
    notificationEmails?: string[];
    webhookUrl?: string;
  };

  @ApiPropertyOptional({
    description: 'Tags for organizing certificates',
    type: [String],
    example: ['production', 'critical'],
  })
  @IsOptional()
  @IsArray({ message: 'Tags must be an array' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Project ID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Project ID must be a valid UUID' })
  projectId?: string;
}

export class UpdatePushCertificateDto {
  @ApiPropertyOptional({
    description: 'Certificate name',
    example: 'Updated Certificate Name',
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({
    description: 'Certificate description',
    example: 'Updated description',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: 'Certificate status',
    enum: CertificateStatus,
    example: CertificateStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(CertificateStatus, { message: 'Status must be a valid certificate status' })
  status?: CertificateStatus;

  @ApiPropertyOptional({
    description: 'Updated certificate data',
    oneOf: [
      { $ref: '#/components/schemas/IOSCertificateDataDto' },
      { $ref: '#/components/schemas/AndroidCertificateDataDto' },
    ],
  })
  @IsOptional()
  @IsObject({ message: 'Certificate data must be an object' })
  @ValidateNested()
  @Type(() => Object)
  certificateData?: IOSCertificateDataDto | AndroidCertificateDataDto;

  @ApiPropertyOptional({
    description: 'Updated list of allowed project IDs',
    type: [String],
    example: ['project-1', 'project-2'],
  })
  @IsOptional()
  @IsArray({ message: 'Allowed projects must be an array' })
  @IsString({ each: true, message: 'Each allowed project must be a string' })
  allowedProjects?: string[];

  @ApiPropertyOptional({
    description: 'Updated access control configuration',
    example: {
      allowedRoles: ['admin'],
      allowedUsers: ['user-1', 'user-2'],
      ipWhitelist: ['192.168.1.0/24'],
    },
  })
  @IsOptional()
  @IsObject({ message: 'Access control must be an object' })
  accessControl?: {
    allowedRoles?: string[];
    allowedUsers?: string[];
    ipWhitelist?: string[];
  };

  @ApiPropertyOptional({
    description: 'Updated certificate rotation configuration',
    example: {
      autoRotate: true,
      rotationDaysBeforeExpiry: 45,
      notificationEmails: ['admin@example.com', 'ops@example.com'],
      webhookUrl: 'https://example.com/webhook',
    },
  })
  @IsOptional()
  @IsObject({ message: 'Rotation config must be an object' })
  rotationConfig?: {
    autoRotate: boolean;
    rotationDaysBeforeExpiry: number;
    notificationEmails?: string[];
    webhookUrl?: string;
  };

  @ApiPropertyOptional({
    description: 'Updated tags',
    type: [String],
    example: ['production', 'critical', 'updated'],
  })
  @IsOptional()
  @IsArray({ message: 'Tags must be an array' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { customField: 'value' },
  })
  @IsOptional()
  @IsObject({ message: 'Metadata must be an object' })
  metadata?: Record<string, any>;
}

export class TestCertificateDto {
  @ApiProperty({
    description: 'Device token to test certificate with',
    example: 'device-token-abc123xyz',
  })
  @IsString({ message: 'Test device token must be a string' })
  testDeviceToken: string;
}

export class TestCertificateResponseDto {
  @ApiProperty({
    description: 'Test result status',
    enum: ['success', 'failed'],
    example: 'success',
  })
  status: 'success' | 'failed';

  @ApiProperty({
    description: 'Test result message',
    example: 'Certificate test successful',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Error details if test failed',
    example: 'Invalid device token',
  })
  error?: string;

  @ApiProperty({
    description: 'Test execution timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  testedAt: Date;
}

export class RotateCertificateDto {
  @ApiProperty({
    description: 'New certificate data to rotate to',
    oneOf: [
      { $ref: '#/components/schemas/IOSCertificateDataDto' },
      { $ref: '#/components/schemas/AndroidCertificateDataDto' },
    ],
  })
  @IsObject({ message: 'New certificate data must be an object' })
  @ValidateNested()
  @Type(() => Object)
  newCertificateData: IOSCertificateDataDto | AndroidCertificateDataDto;
}

export class RotateCertificateResponseDto {
  @ApiProperty({
    description: 'Certificate ID',
    example: 'cert-id-123',
  })
  id: string;

  @ApiProperty({
    description: 'Rotation status',
    enum: ['success', 'pending', 'failed'],
    example: 'success',
  })
  status: 'success' | 'pending' | 'failed';

  @ApiProperty({
    description: 'Previous certificate ID',
    example: 'cert-id-old-123',
  })
  previousCertificateId: string;

  @ApiProperty({
    description: 'Rotation timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  rotatedAt: Date;

  @ApiPropertyOptional({
    description: 'Rollback available until this timestamp',
    example: '2024-12-18T10:30:00Z',
  })
  rollbackAvailableUntil?: Date;
}

export class PushCertificateResponseDto {
  @ApiProperty({
    description: 'Certificate ID',
    example: 'cert-id-123',
  })
  id: string;

  @ApiProperty({
    description: 'Certificate name',
    example: 'Production iOS Certificate',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Certificate description',
    example: 'Main production certificate',
  })
  description?: string;

  @ApiProperty({
    description: 'Certificate type',
    enum: CertificateType,
    example: CertificateType.IOS,
  })
  type: CertificateType;

  @ApiProperty({
    description: 'Certificate environment',
    enum: CertificateEnvironment,
    example: CertificateEnvironment.PRODUCTION,
  })
  environment: CertificateEnvironment;

  @ApiProperty({
    description: 'Certificate status',
    enum: CertificateStatus,
    example: CertificateStatus.ACTIVE,
  })
  status: CertificateStatus;

  @ApiPropertyOptional({
    description: 'Certificate expiration date',
    example: '2025-12-17T10:30:00Z',
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Tags',
    type: [String],
    example: ['production', 'critical'],
  })
  tags?: string[];
}