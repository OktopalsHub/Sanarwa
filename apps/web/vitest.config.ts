import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    include: [
      'src/lib/config/__tests__/validation.test.ts',
      'src/lib/config/__tests__/config-provider.test.tsx',
      'src/lib/config/__tests__/security-basic.test.ts',
      'src/lib/config/__tests__/config-basic.test.ts',
      'src/lib/hooks/__tests__/use-realtime-notifications.test.tsx',
      'src/lib/store/slices/__tests__/notification-slice.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.next/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})