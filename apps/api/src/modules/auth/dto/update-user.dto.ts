import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsUrl } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: "User email address",
    example: "newemail@example.com",
    format: "email",
  })
  @IsOptional()
  @IsEmail({}, { message: "Email must be a valid email address" })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiPropertyOptional({
    description: "User full name",
    example: "John Doe",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(100, { message: "Name must not exceed 100 characters" })
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({
    description: "User profile image URL",
    example: "https://example.com/image.jpg",
    format: "uri",
  })
  @IsOptional()
  @IsUrl({}, { message: "Image must be a valid URL" })
  image?: string;
}

export class UpdateUserResponseDto {
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

  @ApiPropertyOptional({
    description: "User profile image URL",
    example: "https://example.com/image.jpg",
  })
  image?: string;

  @ApiProperty({
    description: "Account creation timestamp",
    example: "2024-12-17T10:30:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2024-12-17T10:30:00Z",
  })
  updatedAt: Date;
}
