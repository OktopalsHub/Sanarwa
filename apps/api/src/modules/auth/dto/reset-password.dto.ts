import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token from email link',
    example: 'reset-token-abc123xyz',
  })
  @IsString({ message: 'Token must be a string' })
  token: string;

  @ApiProperty({
    description: 'New password to set',
    example: 'NewPassword123!',
    minLength: 8,
    maxLength: 100,
  })
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(100, { message: 'New password must not exceed 100 characters' })
  newPassword: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password reset successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp of password reset',
    example: '2024-12-17T10:30:00Z',
  })
  resetAt: Date;
}
