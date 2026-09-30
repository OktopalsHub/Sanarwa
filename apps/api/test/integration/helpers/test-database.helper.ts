import { DataSource } from "typeorm";
import {
  assertSafeTestDatabase,
  createSqliteTestDataSource,
} from "../../../src/test/sqlite-test-data-source";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

/** Isolated entity for helper-based SQLite tests (avoids app entity graph). */
@Entity("test_helper_rows")
export class TestHelperRow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  label!: string;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;
}

export class TestDatabaseHelper {
  private static dataSource: DataSource;

  static async createTestDataSource(): Promise<DataSource> {
    assertSafeTestDatabase();
    if (this.dataSource?.isInitialized) {
      return this.dataSource;
    }

    this.dataSource = createSqliteTestDataSource([TestHelperRow]);
    await this.dataSource.initialize();
    return this.dataSource;
  }

  static async cleanDatabase(): Promise<void> {
    if (!this.dataSource?.isInitialized) return;
    for (const meta of this.dataSource.entityMetadatas) {
      await this.dataSource.getRepository(meta.name).clear();
    }
  }

  static async closeConnection(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
    this.dataSource = undefined as unknown as DataSource;
  }

  static getDataSource(): DataSource {
    return this.dataSource;
  }
}
