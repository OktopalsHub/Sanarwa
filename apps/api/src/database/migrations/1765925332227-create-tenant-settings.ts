import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenantSettings1765925332227 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create tenant_settings table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS tenant_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL UNIQUE,
                email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
                two_factor_auth_required BOOLEAN NOT NULL DEFAULT false,
                api_access_enabled BOOLEAN NOT NULL DEFAULT true,
                allowed_ip_addresses JSONB,
                timezone VARCHAR(50),
                language VARCHAR(10),
                custom_branding JSONB,
                notification_storage_policy VARCHAR(32) NOT NULL DEFAULT 'metadata_only',
                content_retention_days INTEGER,
                retention_policy JSONB,
                metadata JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            )
        `);

        // Create indexes for tenant_settings
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_tenant_settings_tenant_id ON tenant_settings (tenant_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_tenant_settings_two_factor ON tenant_settings (two_factor_auth_required)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS tenant_settings`);
    }

}
