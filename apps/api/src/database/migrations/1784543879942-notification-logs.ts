import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationLogs1784543879942 implements MigrationInterface {
  name = "NotificationLogs1784543879942";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id UUID NOT NULL DEFAULT uuid_generate_v4(),
        tracking_id VARCHAR NOT NULL UNIQUE,
        channel VARCHAR(32) NOT NULL,
        "to" VARCHAR NOT NULL,
        status VARCHAR(32) NOT NULL,
        tenant_id VARCHAR NOT NULL,
        project_id VARCHAR NOT NULL,
        external_id VARCHAR,
        error TEXT,
        scheduled_at TIMESTAMP,
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        failed_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT PK_notification_logs PRIMARY KEY (id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_notification_logs_tenant_created ON notification_logs (tenant_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_notification_logs_tracking ON notification_logs (tracking_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_notification_logs_channel_status ON notification_logs (channel, status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_logs`);
  }
}
