import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenantBillingInfo1765925330483 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS tenant_billing_info (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL UNIQUE,
                plan VARCHAR(50),
                billing_email VARCHAR(255),
                billing_address JSONB,
                payment_method VARCHAR(100),
                payment_status VARCHAR(50),
                next_billing_date TIMESTAMP,
                monthly_amount DECIMAL(10, 2),
                metadata JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_tenant_billing_info_tenant_id ON tenant_billing_info (tenant_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_tenant_billing_info_payment_status ON tenant_billing_info (payment_status)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS tenant_billing_info`);
    }

}
