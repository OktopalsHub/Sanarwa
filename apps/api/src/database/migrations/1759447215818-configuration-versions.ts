import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConfigurationVersions1759447215818 implements MigrationInterface {
  name = 'ConfigurationVersions1759447215818';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS configuration_versions (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        configuration_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        version INTEGER NOT NULL,
        previous_value TEXT,
        new_value TEXT NOT NULL,
        action VARCHAR(20) NOT NULL,
        change_reason VARCHAR(500),
        changed_by VARCHAR(36),
        change_metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_configuration_versions_config FOREIGN KEY (configuration_id) REFERENCES configurations(id) ON DELETE CASCADE,
        CONSTRAINT FK_configuration_versions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_configuration_versions_changed_by FOREIGN KEY (changed_by) REFERENCES "user"(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS configuration_versions;`);
  }
}
