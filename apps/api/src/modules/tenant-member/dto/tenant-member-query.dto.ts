import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { TenantMemberRole } from '../../../common/enums';

export class TenantMemberQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by member role',
    enum: TenantMemberRole,
  })
  @IsOptional()
  @IsEnum(TenantMemberRole)
  role?: TenantMemberRole;

  @ApiPropertyOptional({
    description: 'Search in user name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
