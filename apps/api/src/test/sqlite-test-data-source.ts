import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';

const TEST_DB_TYPES = new Set(['sqljs', 'sqlite', 'better-sqlite3']);

/**
 * Tests must never touch the real Postgres database.
 * Always pin the process to an in-memory SQL.js database.
 */
export function assertSafeTestDatabase(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'sqlite::memory:';
  delete process.env.DATABASE_HOST;
  delete process.env.DATABASE_PORT;
  delete process.env.DATABASE_USERNAME;
  delete process.env.DATABASE_PASSWORD;
  delete process.env.DATABASE_DATABASE;
}

export function createSqliteTestDataSource(
  entities: EntityTarget<ObjectLiteral>[],
  overrides: Partial<DataSourceOptions> = {},
): DataSource {
  assertSafeTestDatabase();

  if (overrides.type && !TEST_DB_TYPES.has(overrides.type)) {
    throw new Error(
      `Refusing test DataSource type "${overrides.type}". Tests may only use in-memory SQLite/SQL.js.`,
    );
  }

  const { type: _ignoredType, database: _ignoredDb, ...safeOverrides } = overrides;

  return new DataSource({
    ...safeOverrides,
    type: 'sqljs',
    location: ':memory:',
    autoSave: false,
    entities,
    synchronize: true,
    dropSchema: true,
    logging: false,
  });
}
