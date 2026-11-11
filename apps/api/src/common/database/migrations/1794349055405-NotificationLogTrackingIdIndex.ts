import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationLogTrackingIdIndex1794349055405 implements MigrationInterface {
  name = "NotificationLogTrackingIdIndex1794349055405";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_logs" DROP CONSTRAINT IF EXISTS "UQ_d622c78dec24303756a0996c3d2"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_logs" ADD CONSTRAINT "UQ_d622c78dec24303756a0996c3d2" UNIQUE ("tracking_id")`,
    );
  }
}
