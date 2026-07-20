import { registerAs } from '@nestjs/config';
import { IsString, IsNumber, IsOptional, IsUrl, validateSync } from 'class-validator';
import { plainToClass, Transform } from 'class-transformer';

class DatabaseConfig {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  port?: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export default registerAs('database', () => {
  const config = {
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME || 'notification_platform',
  };

  // Remove undefined values
  Object.keys(config).forEach(key => {
    if (config[key] === undefined) {
      delete config[key];
    }
  });

  const validatedConfig = plainToClass(DatabaseConfig, config);
  const errors = validateSync(validatedConfig);

  if (errors.length > 0) {
    throw new Error(`Database configuration validation failed: ${errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ')}`);
  }

  return config;
});
