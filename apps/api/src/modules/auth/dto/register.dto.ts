import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";

export class RegisterDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
    format: "email",
  })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase().trim();
    }
    return value;
  })
  @IsEmail({}, { message: "Email must be a valid email address" })
  email: string;

  @ApiProperty({
    description: "User password",
    example: "SecurePassword123!",
    minLength: 6,
    maxLength: 100,
  })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.trim();
    }
    return value;
  })
  @IsString({ message: "Password must be a string" })
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  @MaxLength(100, { message: "Password must not exceed 100 characters" })
  password: string;

  @ApiPropertyOptional({
    description: "User full name",
    example: "John Doe",
  })
  @IsOptional()
  @ValidateIf((o) => o.name !== undefined && o.name !== null)
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.trim();
    }
    return value;
  })
  @IsString({ message: "Name must be a string" })
  name?: string;
}

export class RegisterResponseDto {
  @ApiProperty({
    description: "User ID",
    example: "user-id-123",
  })
  id: string;

  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  email: string;

  @ApiProperty({
    description: "User full name",
    example: "John Doe",
  })
  name: string;

  @ApiProperty({
    description: "Account creation timestamp",
    example: "2024-12-17T10:30:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "JWT access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string;

  @ApiProperty({
    description: "Refresh token",
    example: "refresh_token_here",
  })
  refreshToken: string;
}
