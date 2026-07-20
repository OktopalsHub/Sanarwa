import { ApiProperty } from '@nestjs/swagger';
import { TenantStatus } from '../../../common/enums';

export class TenantResponseDto {
  @ApiProperty({
    description: 'Tenant unique identifier',
    example: '85a51f94-abb9-40fa-8d6d-74d849c9e8fa',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Tenant name',
    example: 'nomida',
    type: String,
  })
  name: string;

  @ApiProperty({
    description: 'Tenant subdomain',
    example: 'nomida',
    type: String,
  })
  subdomain: string;

  @ApiProperty({
    description: 'Tenant invite code',
    example: '8TOXIG',
    type: String,
  })
  inviteCode: string;

  @ApiProperty({
    description: 'Tenant status',
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
    type: String,
  })
  status: TenantStatus;
}

export class TenantListResponseDto {
  @ApiProperty({
    description: 'Tenant unique identifier',
    example: '85a51f94-abb9-40fa-8d6d-74d849c9e8fa',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Tenant name',
    example: 'nomida',
    type: String,
  })
  name: string;

  @ApiProperty({
    description: 'Tenant subdomain',
    example: 'nomida',
    type: String,
  })
  subdomain: string;

  @ApiProperty({
    description: 'Tenant invite code',
    example: '8TOXIG',
    type: String,
  })
  inviteCode: string;

  @ApiProperty({
    description: 'Tenant status',
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
    type: String,
  })
  status: TenantStatus;
}
