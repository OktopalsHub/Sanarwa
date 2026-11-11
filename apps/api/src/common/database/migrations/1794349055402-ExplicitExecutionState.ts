import { MigrationInterface, QueryRunner } from "typeorm";

export class ExplicitExecutionState1794349055402 implements MigrationInterface {
  name = "ExplicitExecutionState1794349055402";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "next_run_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "last_dispatched_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "campaigns" ADD "drip_step" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(
      `CREATE INDEX "IDX_campaigns_next_run_at" ON "campaigns" ("next_run_at") `,
    );

    await queryRunner.query(
      `UPDATE "campaigns"
       SET "next_run_at" = NULLIF(schedule->>'nextRunAt', '')::timestamp
       WHERE "next_run_at" IS NULL
         AND schedule ? 'nextRunAt'
         AND schedule->>'nextRunAt' ~ '^[0-9]{4}-'`,
    );
    await queryRunner.query(
      `UPDATE "campaigns"
       SET "last_dispatched_at" = NULLIF(analytics->>'lastDispatchedAt', '')::timestamp
       WHERE "last_dispatched_at" IS NULL
         AND analytics ? 'lastDispatchedAt'
         AND analytics->>'lastDispatchedAt' ~ '^[0-9]{4}-'`,
    );
    await queryRunner.query(
      `UPDATE "campaigns"
       SET "drip_step" = GREATEST(COALESCE((analytics->>'dripStep')::int, 0), 0)
       WHERE analytics ? 'dripStep'`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_runs" ADD "execution" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `UPDATE "workflow_runs"
       SET "execution" = COALESCE(context->'_execution', '{}'::jsonb)
       WHERE context ? '_execution'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflow_runs" DROP COLUMN "execution"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_campaigns_next_run_at"`);
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "drip_step"`);
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "last_dispatched_at"`);
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "next_run_at"`);
  }
}
