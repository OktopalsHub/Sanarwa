import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueTokenBalancesTenantId1786580420947 implements MigrationInterface {
  name = 'UniqueTokenBalancesTenantId1786580420947';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE token_balance_keepers AS
      SELECT DISTINCT ON (tenant_id) id
      FROM token_balances
      ORDER BY tenant_id, created_at DESC, id DESC
    `);

    await queryRunner.query(`
      UPDATE token_balances AS keeper
      SET
        total_tokens = merged.total_tokens,
        used_tokens = merged.used_tokens,
        reserved_tokens = merged.reserved_tokens,
        available_tokens = GREATEST(
          0,
          merged.total_tokens - merged.used_tokens - merged.reserved_tokens
        ),
        last_usage = merged.last_usage,
        last_purchase = merged.last_purchase,
        updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT
          tenant_id,
          SUM(total_tokens) AS total_tokens,
          SUM(used_tokens) AS used_tokens,
          SUM(reserved_tokens) AS reserved_tokens,
          MAX(last_usage) AS last_usage,
          MAX(last_purchase) AS last_purchase
        FROM token_balances
        GROUP BY tenant_id
      ) AS merged
      WHERE keeper.tenant_id = merged.tenant_id
        AND keeper.id IN (SELECT id FROM token_balance_keepers)
    `);

    await queryRunner.query(`
      DELETE FROM token_balances
      WHERE id NOT IN (SELECT id FROM token_balance_keepers)
    `);

    await queryRunner.query(`DROP TABLE token_balance_keepers`);

    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_token_balances_tenant_id
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_token_balances_tenant_id
      ON token_balances (tenant_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS UQ_token_balances_tenant_id
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_token_balances_tenant_id
      ON token_balances (tenant_id)
    `);
  }
}
