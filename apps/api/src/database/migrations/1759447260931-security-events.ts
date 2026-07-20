import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityEvents1759447260931 implements MigrationInterface {
  name = 'SecurityEvents1759447260931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS security_events (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID,
        user_id VARCHAR(36),
        event_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'low',
        description TEXT NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        session_id VARCHAR(255),
        resource_type VARCHAR(50),
        resource_id UUID,
        metadata JSONB,
        request_details JSONB,
        resolved BOOLEAN NOT NULL DEFAULT false,
        resolved_by VARCHAR(36),
        resolved_at TIMESTAMP,
        resolution TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_tenant_id ON security_events (tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events (user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events (created_at)`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE security_events
          ADD CONSTRAINT fk_security_events_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE security_events
          ADD CONSTRAINT fk_security_events_user
          FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE security_events
          ADD CONSTRAINT fk_security_events_resolved_by
          FOREIGN KEY (resolved_by) REFERENCES "user"(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS security_events`);
  }
}
