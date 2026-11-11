import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { SearchSortQueryDto } from "../../../common/dto/search-sort.dto";
import { ApiKeyStatus, ApiKeyEnvironment } from "../entities/api-key.entity";

export class ApiKeyQueryDto extends SearchSortQueryDto {
  @ApiPropertyOptional({
    description: "Filter by API key status",
    enum: ApiKeyStatus,
    example: ApiKeyStatus.ACTIVE,
    type: String,
  })
  @IsOptional()
  @IsEnum(ApiKeyStatus)
  status?: ApiKeyStatus;

  @ApiPropertyOptional({
    description: "Filter by API key environment",
    enum: ApiKeyEnvironment,
    example: ApiKeyEnvironment.PRODUCTION,
    type: String,
  })
  @IsOptional()
  @IsEnum(ApiKeyEnvironment)
  environment?: ApiKeyEnvironment;
}
