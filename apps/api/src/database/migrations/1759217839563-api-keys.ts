import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeys1759217839563 implements MigrationInterface {
  name = 'ApiKeys1759217839563';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(255) NOT NULL,
        environment VARCHAR(16) NOT NULL DEFAULT 'production',
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        permissions JSONB NOT NULL DEFAULT '["notifications:send", "templates:read"]',
        ip_whitelist JSONB,
        expires_at TIMESTAMP,
        last_used_at TIMESTAMP,
        last_used_ip VARCHAR(45),
        usage_count INTEGER NOT NULL DEFAULT 0,
        rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
        rate_limit_per_hour INTEGER NOT NULL DEFAULT 10000,
        rate_limit_per_day INTEGER NOT NULL DEFAULT 100000,
        metadata JSONB,
        project_id UUID NOT NULL,
        created_by_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_api_keys_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_api_keys_created_by_id FOREIGN KEY (created_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL,
        CONSTRAINT UQ_api_keys_key_hash UNIQUE (key_hash),
        CONSTRAINT UQ_api_keys_key_prefix UNIQUE (key_prefix)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_api_keys_project_id_status ON api_keys (project_id, status);
      CREATE INDEX IF NOT EXISTS IDX_api_keys_key_hash ON api_keys (key_hash);
      CREATE INDEX IF NOT EXISTS IDX_api_keys_key_prefix ON api_keys (key_prefix);
      CREATE INDEX IF NOT EXISTS IDX_api_keys_status ON api_keys (status);
      CREATE INDEX IF NOT EXISTS IDX_api_keys_expires_at ON api_keys (expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('api_keys');
  }
}
