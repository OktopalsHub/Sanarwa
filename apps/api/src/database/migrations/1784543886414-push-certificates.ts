import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushCertificates1784543886414 implements MigrationInterface {
  name = 'PushCertificates1784543886414';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS push_certificates (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending_validation',
        environment VARCHAR(20) NOT NULL DEFAULT 'development',
        certificate_data JSONB NOT NULL,
        expires_at TIMESTAMP,
        issued_at TIMESTAMP,
        issuer VARCHAR(255),
        subject VARCHAR(255),
        fingerprint TEXT,
        last_validated_at TIMESTAMP,
        last_tested_at TIMESTAMP,
        validation_result JSONB,
        test_result JSONB,
        total_notifications_sent INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMP,
        rotation_config JSONB,
        next_rotation_at TIMESTAMP,
        allowed_projects TEXT[],
        access_control JSONB,
        tags TEXT[],
        metadata JSONB,
        tenant_id UUID NOT NULL,
        created_by_id UUID NOT NULL,
        project_id UUID,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_push_certificates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_push_certificates_created_by FOREIGN KEY (created_by_id) REFERENCES tenant_members(id) ON DELETE CASCADE,
        CONSTRAINT FK_push_certificates_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );
    `);

    // Create indexes for better performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_certificates_tenant_id ON push_certificates(tenant_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_certificates_status ON push_certificates(status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_certificates_type ON push_certificates(type);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_certificates_environment ON push_certificates(environment);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_certificates_project_id ON push_certificates(project_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_certificates_expires_at ON push_certificates(expires_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_certificates_created_by_id ON push_certificates(created_by_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_push_certificates_created_by_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_push_certificates_expires_at;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_push_certificates_project_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_push_certificates_environment;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_push_certificates_type;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_push_certificates_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_push_certificates_tenant_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS push_certificates;`);
  }
}