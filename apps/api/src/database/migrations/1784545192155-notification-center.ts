import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationCenter1784545192155 implements MigrationInterface {
  name = "NotificationCenter1784545192155";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_center (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tenant_id VARCHAR NOT NULL,
        subscriber_id VARCHAR NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        channel VARCHAR(50) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'unread',
        read_at TIMESTAMP,
        archived_at TIMESTAMP,
        action_url VARCHAR(500),
        action_label VARCHAR(100),
        image_url VARCHAR(500),
        metadata JSONB,
        template_id VARCHAR(255),
        message_id VARCHAR(255),
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_notification_center_subscriber_status ON notification_center (subscriber_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_notification_center_subscriber_created ON notification_center (subscriber_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_notification_center_tenant_created ON notification_center (tenant_id, created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_center`);
  }
}
