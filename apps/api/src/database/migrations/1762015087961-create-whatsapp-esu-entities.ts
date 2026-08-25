import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWhatsappEsuEntities1762015087961 implements MigrationInterface {
  name = "CreateWhatsappEsuEntities1762015087961";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create WABA configs table for ESU pattern
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS waba_configs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id VARCHAR,
        business_account_id VARCHAR NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        phone_number_id VARCHAR NOT NULL,
        webhook_verify_token VARCHAR NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_byop BOOLEAN NOT NULL DEFAULT false,
        region VARCHAR NOT NULL DEFAULT 'global',
        template_count INTEGER NOT NULL DEFAULT 0,
        max_templates INTEGER NOT NULL DEFAULT 6000,
        last_used_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    // Create tenant WABA configurations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_waba_configs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id VARCHAR NOT NULL,
        waba_id UUID NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        usage_stats JSONB NOT NULL DEFAULT '{"messagesSent": 0, "templatesUsed": 0, "totalCost": 0}',
        access_token TEXT,
        phone_number_id VARCHAR,
        status VARCHAR NOT NULL DEFAULT 'PENDING',
        verification_status VARCHAR NOT NULL DEFAULT 'UNVERIFIED',
        last_sync_at TIMESTAMP,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_tenant_waba_config_waba FOREIGN KEY (waba_id) REFERENCES waba_configs(id) ON DELETE CASCADE,
        CONSTRAINT UQ_tenant_waba_unique UNIQUE (tenant_id, waba_id)
      )
    `);

    // Create tenant WABA assignments table (legacy support)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_waba_assignments (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id VARCHAR NOT NULL,
        waba_id UUID NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        messages_sent INTEGER NOT NULL DEFAULT 0,
        templates_used INTEGER NOT NULL DEFAULT 0,
        total_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
        last_message_at TIMESTAMP,
        access_token TEXT,
        phone_number_id VARCHAR,
        status VARCHAR NOT NULL DEFAULT 'PENDING',
        verification_status VARCHAR NOT NULL DEFAULT 'UNVERIFIED',
        last_sync_at TIMESTAMP,
        usage JSONB,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_tenant_waba_assignment_waba FOREIGN KEY (waba_id) REFERENCES waba_configs(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order due to foreign key constraints
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_waba_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_waba_configs`);
    await queryRunner.query(`DROP TABLE IF EXISTS waba_configs`);
  }
}
