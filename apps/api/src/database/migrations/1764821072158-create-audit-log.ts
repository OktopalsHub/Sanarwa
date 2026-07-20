import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLog1764821072158 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        tenant_member_id UUID,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID NOT NULL,
        description TEXT NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        session_id UUID,
        old_values JSONB,
        new_values JSONB,
        metadata JSONB,
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        duration INTEGER NOT NULL DEFAULT 0,
        correlation_id UUID,
        request_id UUID,
        request_headers JSONB,
        response_data JSONB,
        api_version VARCHAR(20),
        client_version VARCHAR(50),
        tags TEXT[],
        severity VARCHAR(20) NOT NULL DEFAULT 'low',
        compliance_flags TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_member_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_audit_logs_tenant_id_created_at ON audit_logs (tenant_id, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_audit_logs_tenant_member_id_created_at ON audit_logs (tenant_member_id, created_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_audit_logs_resource_type_resource_id ON audit_logs (resource_type, resource_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_audit_logs_action ON audit_logs (action)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_audit_logs_severity ON audit_logs (severity)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_audit_logs_created_at ON audit_logs (created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
  }
}
