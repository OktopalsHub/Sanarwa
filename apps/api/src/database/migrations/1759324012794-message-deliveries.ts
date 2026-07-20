import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageDeliveries1759324012794 implements MigrationInterface {
  name = 'MessageDeliveries1759324012794';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS message_deliveries (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        message_id UUID NOT NULL,
        tenant_id UUID NOT NULL,
        channel VARCHAR(20) NOT NULL,
        provider_id VARCHAR(255) NOT NULL,
        recipient VARCHAR(500) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        provider_message_id VARCHAR(255),
        provider_response JSONB,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_message_deliveries_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        CONSTRAINT FK_message_deliveries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS message_deliveries;`);
  }
}
