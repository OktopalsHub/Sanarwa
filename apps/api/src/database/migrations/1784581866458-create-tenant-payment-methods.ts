import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantPaymentMethods1784581866458 implements MigrationInterface {
  name = 'CreateTenantPaymentMethods1784581866458';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_payment_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        provider VARCHAR(16) NOT NULL,
        currency VARCHAR(8) NOT NULL,
        external_customer_id VARCHAR(255) NOT NULL,
        external_payment_method_id VARCHAR(255),
        external_subscription_id VARCHAR(255),
        card_brand VARCHAR(32),
        card_last4 VARCHAR(4),
        card_exp_month INTEGER,
        card_exp_year INTEGER,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT FK_tenant_payment_methods_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_tenant_payment_methods_tenant
        ON tenant_payment_methods (tenant_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_tenant_payment_methods_tenant_default
        ON tenant_payment_methods (tenant_id, is_default)
    `);

    await queryRunner.query(`
      ALTER TABLE auto_topup_configs
        ADD COLUMN IF NOT EXISTS package_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS currency VARCHAR(8),
        ADD COLUMN IF NOT EXISTS payment_method_id UUID,
        ADD COLUMN IF NOT EXISTS setup_reference VARCHAR(128)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_auto_topup_configs_payment_method'
        ) THEN
          ALTER TABLE auto_topup_configs
            ADD CONSTRAINT FK_auto_topup_configs_payment_method
            FOREIGN KEY (payment_method_id)
            REFERENCES tenant_payment_methods(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auto_topup_configs
        DROP CONSTRAINT IF EXISTS FK_auto_topup_configs_payment_method
    `);

    await queryRunner.query(`
      ALTER TABLE auto_topup_configs
        DROP COLUMN IF EXISTS setup_reference,
        DROP COLUMN IF EXISTS payment_method_id,
        DROP COLUMN IF EXISTS currency,
        DROP COLUMN IF EXISTS package_id
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS tenant_payment_methods`);
  }
}
