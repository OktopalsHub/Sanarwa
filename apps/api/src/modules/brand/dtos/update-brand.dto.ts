import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateBrandDto } from './create-brand.dto';
import { BrandStatus } from 'src/common/enums';

export class UpdateBrandDto extends PartialType(CreateBrandDto) {
  @ApiPropertyOptional({
    description: 'Brand status',
    enum: BrandStatus,
    example: BrandStatus.ACTIVE,
  })
  @IsEnum(BrandStatus)
  @IsOptional()
  status?: BrandStatus;
}
