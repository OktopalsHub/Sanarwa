import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpsertProjectQuotaDto {
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  limit: number;

  @IsInt()
  @Min(10)
  @Max(86_400)
  windowSeconds: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
