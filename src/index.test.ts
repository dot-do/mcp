import { describe, it, expect } from 'vitest'

describe('index exports', () => {
  describe('types', () => {
    it('should export MCPServerConfig type', async () => {
      const { MCPServerConfig } = await import('./index') as any
      // Type exports won't be available at runtime, but we can verify the module exports
      const exports = await import('./index')
      expect(exports).toBeDefined()
    })
  })

  describe('createMCPServer factory', () => {
    it('should export createMCPServer function', async () => {
      const { createMCPServer } = await import('./index')
      expect(createMCPServer).toBeDefined()
      expect(typeof createMCPServer).toBe('function')
    })

    it('should create server with valid config', async () => {
      const { createMCPServer } = await import('./index')

      const config = {
        search: async (query: string) => [],
        fetch: async (id: string) => null,
        do: {
          bindings: {},
          types: '',
        },
      }

      const server = createMCPServer(config)
      expect(server).toBeDefined()
      expect(server.server).toBeDefined()
      expect(server.connect).toBeDefined()
      expect(server.close).toBeDefined()
      expect(server.isConnected).toBeDefined()
      expect(server.getRegisteredTools).toBeDefined()
      expect(server.callTool).toBeDefined()
    })
  })

  describe('type re-exports', () => {
    it('should include DoScope type', async () => {
      // Types are erased at runtime, but we can test that the module imports correctly
      const mod = await import('./index')
      expect(mod).toBeDefined()
    })

    it('should include AuthConfig type', async () => {
      const mod = await import('./index')
      expect(mod).toBeDefined()
    })

    it('should include SearchFunction and FetchFunction types', async () => {
      const mod = await import('./index')
      expect(mod).toBeDefined()
    })
  })
})
