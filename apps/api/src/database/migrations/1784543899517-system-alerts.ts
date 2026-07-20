import { MigrationInterface, QueryRunner } from 'typeorm';

export class SystemAlerts1784543899517 implements MigrationInterface {
  name = 'SystemAlerts1784543899517';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS system_alerts (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        alert_type VARCHAR NOT NULL,
        severity VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'active',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        recipients JSONB,
        resolution_notes TEXT,
        acknowledged_by_member_id UUID,
        acknowledged_at TIMESTAMP,
        resolved_by_member_id UUID,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_system_alerts_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_system_alerts_tenant_id ON system_alerts (tenant_id);
      CREATE INDEX IF NOT EXISTS IDX_system_alerts_alert_type ON system_alerts (alert_type);
      CREATE INDEX IF NOT EXISTS IDX_system_alerts_severity ON system_alerts (severity);
      CREATE INDEX IF NOT EXISTS IDX_system_alerts_status ON system_alerts (status);
      CREATE INDEX IF NOT EXISTS IDX_system_alerts_created_at ON system_alerts (created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS system_alerts`);
  }
}