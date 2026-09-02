import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInappFeedColumns1788298454986 implements MigrationInterface {
  name = "AddInappFeedColumns1788298454986";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS transaction_id UUID`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS feed_id VARCHAR DEFAULT 'default'`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT false`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS seen_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS subscriber_id VARCHAR`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS priority VARCHAR`);
    await queryRunner.query(`ALTER TABLE in_app_notifications ADD COLUMN IF NOT EXISTS avatar VARCHAR`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_in_app_tenant_feed ON in_app_notifications (tenant_id, feed_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_in_app_subscriber_seen ON in_app_notifications (subscriber_id, seen)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS IDX_in_app_transaction_tenant ON in_app_notifications (transaction_id, tenant_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS transaction_id`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS feed_id`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS seen`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS seen_at`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS archived`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS archived_at`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS subscriber_id`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS priority`);
    await queryRunner.query(`ALTER TABLE in_app_notifications DROP COLUMN IF EXISTS avatar`);
  }
}
