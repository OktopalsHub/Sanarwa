import { MigrationInterface, QueryRunner } from "typeorm";

export class ProviderConfigs1759324039332 implements MigrationInterface {
  name = "ProviderConfigs1759324039332";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS provider_configs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        project_id UUID NOT NULL,
        provider_id VARCHAR(100) NOT NULL,
        provider_name VARCHAR(50) NOT NULL,
        provider_type VARCHAR(30) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        config JSONB NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_default BOOLEAN NOT NULL DEFAULT false,
        priority INTEGER NOT NULL DEFAULT 1,
        supported_countries JSONB,
        rate_limits JSONB,
        health_check JSONB,
        last_health_check TIMESTAMP,
        health_status VARCHAR(50) NOT NULL DEFAULT 'unknown',
        metadata JSONB,
        created_by_id UUID NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_provider_configs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_provider_configs_created_by FOREIGN KEY (created_by_id) REFERENCES tenant_members(id) ON DELETE RESTRICT,
        CONSTRAINT UQ_provider_configs_project_provider_channel UNIQUE (project_id, provider_id, channel)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_provider_configs_project_id ON provider_configs(project_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_provider_configs_project_channel ON provider_configs(project_id, channel);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_provider_configs_project_active ON provider_configs(project_id, is_active);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_provider_configs_project_active;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_provider_configs_project_channel;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_provider_configs_project_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS provider_configs;`);
  }
}
