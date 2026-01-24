import { defineConfig } from 'vitest/config'

/**
 * Node.js configuration for tests that use @modelcontextprotocol/sdk.
 * The SDK depends on ajv which doesn't work in the workerd runtime.
 *
 * Run with: npm run test:node
 */
export default defineConfig({
  test: {
    include: [
      'src/server.test.ts',
      'src/index.test.ts',
      'src/types.test.ts',
      'src/auth/**/*.test.ts',
    ],
    globals: true,
    environment: 'node',
    testTimeout: 30000,
  },
})
