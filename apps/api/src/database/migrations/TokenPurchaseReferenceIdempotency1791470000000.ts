import { MigrationInterface, QueryRunner } from "typeorm";

export class TokenPurchaseReferenceIdempotency1791470000000 implements MigrationInterface {
  name = "TokenPurchaseReferenceIdempotency1791470000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_token_purchase_reference_unique"
      ON "token_transactions" ("tenant_id", "reference_id")
      WHERE "type" = 'purchase' AND "reference_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_token_purchase_reference_unique"
    `);
  }
}
