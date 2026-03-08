import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      enabled: false,
      all: true,
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', '**/*.d.ts', 'dist/**', 'tests/**'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
})
