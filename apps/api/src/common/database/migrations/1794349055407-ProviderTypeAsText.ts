import { MigrationInterface, QueryRunner } from "typeorm";

const ORIGINAL_VALUES = [
  "aws_ses",
  "aws_sns",
  "aws_pinpoint",
  "termii",
  "twilio",
  "sendgrid",
  "smtp",
  "firebase",
  "whatsapp",
  "whatsapp_business",
  "slack",
  "discord",
  "telegram",
  "custom",
];

export class ProviderTypeAsText1794349055407 implements MigrationInterface {
  name = "ProviderTypeAsText1794349055407";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "provider_configs" ALTER COLUMN "provider_type" TYPE character varying(50) USING "provider_type"::text`,
    );
    await queryRunner.query(`DROP TYPE "public"."provider_configs_provider_type_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const values = ORIGINAL_VALUES.map((value) => `'${value}'`).join(", ");
    await queryRunner.query(
      `CREATE TYPE "public"."provider_configs_provider_type_enum" AS ENUM(${values})`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_configs" ALTER COLUMN "provider_type" TYPE "public"."provider_configs_provider_type_enum" USING (CASE WHEN "provider_type" IN (${values}) THEN "provider_type" ELSE 'custom' END)::"public"."provider_configs_provider_type_enum"`,
    );
  }
}
