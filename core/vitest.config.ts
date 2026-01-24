import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

/**
 * Workers pool configuration for tests that run in the workerd runtime.
 * This is for code that uses ai-evaluate and worker_loaders.
 *
 * Tests that use @modelcontextprotocol/sdk (which depends on ajv)
 * must run in Node.js - see vitest.node.config.ts
 */
export default defineWorkersConfig({
  test: {
    include: [
      'src/types.test.ts',
      'src/tools/**/*.test.ts',
      'src/scope/**/*.test.ts',
    ],
    exclude: [
      'src/server.test.ts', // Uses @modelcontextprotocol/sdk which has ajv (not workers compatible)
      'src/index.test.ts',  // Imports from server.ts
    ],
    globals: true,
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: {
          configPath: './wrangler.test.jsonc',
        },
      },
    },
  },
})
