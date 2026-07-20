import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiKeyStatus, ApiKeyEnvironment } from '../entities/api-key.entity';

export class ApiKeyQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by API key status',
    enum: ApiKeyStatus,
    example: ApiKeyStatus.ACTIVE,
    type: String,
  })
  @IsOptional()
  @IsEnum(ApiKeyStatus)
  status?: ApiKeyStatus;

  @ApiPropertyOptional({
    description: 'Filter by API key environment',
    enum: ApiKeyEnvironment,
    example: ApiKeyEnvironment.PRODUCTION,
    type: String,
  })
  @IsOptional()
  @IsEnum(ApiKeyEnvironment)
  environment?: ApiKeyEnvironment;

  @ApiPropertyOptional({
    description: 'Search in API key name or prefix',
    example: 'Production',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'createdAt',
    example: 'createdAt',
    type: String,
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    type: String,
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
