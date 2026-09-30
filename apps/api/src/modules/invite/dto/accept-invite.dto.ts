import { IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class AcceptInviteDto {
  @IsString()
  token: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  password?: string;
}
