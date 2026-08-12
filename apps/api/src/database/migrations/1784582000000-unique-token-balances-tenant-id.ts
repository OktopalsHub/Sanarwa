import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueTokenBalancesTenantId1784582000000 implements MigrationInterface {
  name = 'UniqueTokenBalancesTenantId1784582000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keep one balance row per tenant if duplicates already exist.
    await queryRunner.query(`
      DELETE FROM token_balances a
      USING token_balances b
      WHERE a.tenant_id = b.tenant_id
        AND a.created_at < b.created_at
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_token_balances_tenant_id"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_token_balances_tenant_id" ON "token_balances" ("tenant_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_token_balances_tenant_id"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_token_balances_tenant_id" ON "token_balances" ("tenant_id")
    `);
  }
}
