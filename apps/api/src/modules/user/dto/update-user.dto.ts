import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Length } from "class-validator";

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: "User name",
    example: "John Doe",
    minLength: 1,
    maxLength: 255,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    description: "User avatar URL",
    example: "https://example.com/avatar.jpg",
    type: String,
  })
  @IsOptional()
  @IsString()
  image?: string;
}
