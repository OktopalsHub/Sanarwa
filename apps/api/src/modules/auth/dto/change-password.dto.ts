import { IsString, MinLength, MaxLength, NotEquals } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'CurrentPassword123!',
    minLength: 8,
    maxLength: 100,
  })
  @IsString({ message: 'Current password must be a string' })
  @MinLength(8, { message: 'Current password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Current password must not exceed 100 characters' })
  currentPassword: string;

  @ApiProperty({
    description: 'New password to set',
    example: 'NewPassword123!',
    minLength: 8,
    maxLength: 100,
  })
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(100, { message: 'New password must not exceed 100 characters' })
  @NotEquals('currentPassword', {
    message: 'New password must be different from current password',
  })
  newPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password changed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp of password change',
    example: '2024-12-17T10:30:00Z',
  })
  changedAt: Date;
}
