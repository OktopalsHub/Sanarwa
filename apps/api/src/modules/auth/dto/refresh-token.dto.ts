import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token to obtain new access token",
    example: "refresh_token_abc123xyz",
  })
  @IsString({ message: "Refresh token must be a string" })
  refreshToken: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({
    description: "New JWT access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string;

  @ApiProperty({
    description: "New refresh token",
    example: "refresh_token_new_abc123xyz",
  })
  refreshToken: string;

  @ApiProperty({
    description: "Token expiration time in seconds",
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: "Token type",
    example: "Bearer",
  })
  tokenType: string;
}
