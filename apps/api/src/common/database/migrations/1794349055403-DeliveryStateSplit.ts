import { MigrationInterface, QueryRunner } from "typeorm";

export class DeliveryStateSplit1794349055403 implements MigrationInterface {
  name = "DeliveryStateSplit1794349055403";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."message_deliveries_transport_status_enum" AS ENUM('pending', 'sent', 'failed', 'skipped')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."message_deliveries_engagement_status_enum" AS ENUM('unknown', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'complained', 'failed')`,
    );

    await queryRunner.query(
      `ALTER TABLE "message_deliveries" ADD "transport_status" "public"."message_deliveries_transport_status_enum" NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_deliveries" ADD "engagement_status" "public"."message_deliveries_engagement_status_enum" NOT NULL DEFAULT 'unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "message_deliveries" ADD "state_updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );

    await queryRunner.query(`
      UPDATE "message_deliveries"
      SET
        "transport_status" = CASE
          WHEN "status" IN ('pending') THEN 'pending'::"public"."message_deliveries_transport_status_enum"
          WHEN "status" IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed') THEN 'sent'::"public"."message_deliveries_transport_status_enum"
          WHEN "status" IN ('skipped') THEN 'skipped'::"public"."message_deliveries_transport_status_enum"
          ELSE 'failed'::"public"."message_deliveries_transport_status_enum"
        END,
        "engagement_status" = CASE
          WHEN "status" = 'delivered' THEN 'delivered'::"public"."message_deliveries_engagement_status_enum"
          WHEN "status" = 'opened' THEN 'opened'::"public"."message_deliveries_engagement_status_enum"
          WHEN "status" = 'clicked' THEN 'clicked'::"public"."message_deliveries_engagement_status_enum"
          WHEN "status" = 'bounced' THEN 'bounced'::"public"."message_deliveries_engagement_status_enum"
          WHEN "status" = 'unsubscribed' THEN 'unsubscribed'::"public"."message_deliveries_engagement_status_enum"
          WHEN "status" = 'failed' THEN 'failed'::"public"."message_deliveries_engagement_status_enum"
          ELSE 'unknown'::"public"."message_deliveries_engagement_status_enum"
        END,
        "state_updated_at" = COALESCE("updated_at", now())
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_message_deliveries_transport_status" ON "message_deliveries" ("transport_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_deliveries_engagement_status" ON "message_deliveries" ("engagement_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_message_deliveries_engagement_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_message_deliveries_transport_status"`);
    await queryRunner.query(`ALTER TABLE "message_deliveries" DROP COLUMN "state_updated_at"`);
    await queryRunner.query(`ALTER TABLE "message_deliveries" DROP COLUMN "engagement_status"`);
    await queryRunner.query(`ALTER TABLE "message_deliveries" DROP COLUMN "transport_status"`);
    await queryRunner.query(`DROP TYPE "public"."message_deliveries_engagement_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."message_deliveries_transport_status_enum"`);
  }
}
