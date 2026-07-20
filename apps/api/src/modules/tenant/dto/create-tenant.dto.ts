import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'Tenant name',
    example: 'Acme Corporation',
    minLength: 1,
    maxLength: 255,
    type: String,
  })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiPropertyOptional({
    description:
      'Tenant subdomain (lowercase letters, numbers, and hyphens only)',
    example: 'acme-corp',
    minLength: 3,
    maxLength: 100,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain?: string;
}
