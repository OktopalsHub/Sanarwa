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
    include: ["test/mcp-endpoint.vitest.e2e.spec.ts"],
    env: {
      NODE_ENV: "development",
    },
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
