import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email address to send password reset link',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Password reset link sent to your email',
  })
  message: string;

  @ApiProperty({
    description: 'Email address where reset link was sent',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Expiration time of reset link in minutes',
    example: 30,
  })
  expiresIn: number;
}
