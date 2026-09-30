import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWebhook1766923292947 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create webhooks table
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS webhooks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL,
                name VARCHAR(255),
                url VARCHAR(2048) NOT NULL,
                secret VARCHAR(255),
                events JSONB NOT NULL DEFAULT '[]',
                active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            )
        `);

    // Create indexes for webhooks
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_webhooks_tenant_id ON webhooks (tenant_id)`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks (active)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS webhooks`);
  }
}
