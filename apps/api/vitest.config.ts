import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/vitest.setup.ts'],
    include: [
      'src/app.controller.spec.ts',
      'src/common/errors/services/circuit-breaker.service.spec.ts',
      'src/common/errors/services/error-classification.service.spec.ts',
      'src/common/errors/exceptions/base.exception.spec.ts',
      'src/common/errors/errors.module.spec.ts',
      'src/common/helpers/**/*.spec.ts',
      'src/common/security/services/input-sanitization.service.spec.ts',
      'src/providers/sms/**/*.spec.ts',
      'src/modules/tenant/services/tenant-schema.service.spec.ts',
      'src/modules/configuration/services/test/configuration-validation.service.spec.ts',
      'src/modules/brand/tests/brand.service.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Never load developer .env that points at real Postgres
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'sqlite::memory:',
    },
  },
});
