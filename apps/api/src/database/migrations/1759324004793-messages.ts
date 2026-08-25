import { MigrationInterface, QueryRunner } from "typeorm";

export class Messages1759324004793 implements MigrationInterface {
  name = "Messages1759324004793";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        template_id UUID,
        created_by_id UUID,
        channels JSONB NOT NULL,
        recipients JSONB NOT NULL,
        data JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        priority VARCHAR(10) NOT NULL DEFAULT 'normal',
        scheduled_at TIMESTAMP,
        subject TEXT,
        content TEXT,
        metadata JSONB,
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_messages_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        CONSTRAINT FK_messages_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
        CONSTRAINT FK_messages_created_by FOREIGN KEY (created_by_id) REFERENCES tenant_members(id) ON DELETE SET NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS messages;`);
  }
}
