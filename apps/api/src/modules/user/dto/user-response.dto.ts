import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    type: String,
  })
  email: string;

  @ApiPropertyOptional({
    description: 'User name',
    example: 'John Doe',
    type: String,
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    type: String,
  })
  image?: string;

  @ApiProperty({
    description: 'Whether the user email is verified',
    example: true,
    type: Boolean,
  })
  emailVerified: boolean;

  @ApiProperty({
    description: 'User creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'User deletion timestamp',
    example: null,
    type: Date,
    nullable: true,
  })
  deletedAt?: Date | null;
}
