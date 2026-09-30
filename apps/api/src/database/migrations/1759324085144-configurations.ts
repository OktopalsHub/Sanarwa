import { MigrationInterface, QueryRunner } from "typeorm";

export class Configurations1759324085144 implements MigrationInterface {
  name = "Configurations1759324085144";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS configurations (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        config_key VARCHAR(255) NOT NULL,
        config_value JSONB NOT NULL,
        config_type VARCHAR(50) NOT NULL DEFAULT 'general',
        description TEXT,
        is_encrypted BOOLEAN NOT NULL DEFAULT false,
        is_system BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        validation_schema JSONB,
        default_value JSONB,
        created_by_id VARCHAR(36),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_configurations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_configurations_created_by FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL,
        CONSTRAINT UQ_configurations_tenant_key UNIQUE (tenant_id, config_key)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS configurations;`);
  }
}
