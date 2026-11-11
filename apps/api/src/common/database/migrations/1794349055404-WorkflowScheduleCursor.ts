import { MigrationInterface, QueryRunner } from "typeorm";

export class WorkflowScheduleCursor1794349055404 implements MigrationInterface {
  name = "WorkflowScheduleCursor1794349055404";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflows" ADD "next_run_at" TIMESTAMP`);

    await queryRunner.query(`
      UPDATE "workflows"
      SET "next_run_at" = NULLIF("metadata"->'schedule'->>'nextRunAt', '')::timestamp
      WHERE "next_run_at" IS NULL
        AND "metadata" ? 'schedule'
        AND "metadata"->'schedule' ? 'nextRunAt'
        AND "metadata"->'schedule'->>'nextRunAt' ~ '^[0-9]{4}-'
    `);

    await queryRunner.query(`
      UPDATE "workflow_runs"
      SET "execution" = jsonb_set(
        COALESCE("execution", '{}'::jsonb),
        '{frames}',
        "context"->'_frames'
      )
      WHERE "context" ? '_frames'
        AND NOT "execution" ? 'frames'
    `);
    await queryRunner.query(`
      UPDATE "workflow_runs"
      SET "execution" = jsonb_set(
        COALESCE("execution", '{}'::jsonb),
        '{signalKeys}',
        "context"->'_signalKeys'
      )
      WHERE "context" ? '_signalKeys'
        AND NOT "execution" ? 'signalKeys'
    `);
    await queryRunner.query(`
      UPDATE "workflow_runs"
      SET "execution" = jsonb_set(
        COALESCE("execution", '{}'::jsonb),
        '{retryStep}',
        ("context"->'_retryStep')::jsonb
      )
      WHERE "context" ? '_retryStep'
        AND NOT "execution" ? 'retryStep'
    `);
    await queryRunner.query(`
      UPDATE "workflow_runs"
      SET "execution" = jsonb_set(
        COALESCE("execution", '{}'::jsonb),
        '{stepRetryCount}',
        ("context"->'_stepRetryCount')::jsonb
      )
      WHERE "context" ? '_stepRetryCount'
        AND NOT "execution" ? 'stepRetryCount'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN "next_run_at"`);
  }
}
