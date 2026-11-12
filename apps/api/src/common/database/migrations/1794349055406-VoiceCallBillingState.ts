import { MigrationInterface, QueryRunner } from "typeorm";

export class VoiceCallBillingState1794349055406 implements MigrationInterface {
  name = "VoiceCallBillingState1794349055406";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "voice_calls" ADD "answered_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "voice_calls" ADD "billed_at" TIMESTAMP`);
    await queryRunner.query(
      `UPDATE "voice_calls" SET "billed_at" = "ended_at" WHERE "status" = 'ended' AND "duration" > 0`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_voice_calls_unbilled" ON "voice_calls" ("status", "billed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_token_usage_reference" ON "token_transactions" ("tenant_id", "reference_id") WHERE "type" = 'usage' AND "reference_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_token_usage_reference"`);
    await queryRunner.query(`DROP INDEX "IDX_voice_calls_unbilled"`);
    await queryRunner.query(`ALTER TABLE "voice_calls" DROP COLUMN "billed_at"`);
    await queryRunner.query(`ALTER TABLE "voice_calls" DROP COLUMN "answered_at"`);
  }
}
