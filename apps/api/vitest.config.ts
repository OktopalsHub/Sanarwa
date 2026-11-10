import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2022",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/vitest.setup.ts"],
    include: ["src/**/*.spec.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.e2e.spec.ts",
      "**/*.http.spec.ts",
      "**/*.integration.spec.ts",
      "**/*.vitest.spec.ts",
    ],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "sqlite::memory:",
    },
  },
});
