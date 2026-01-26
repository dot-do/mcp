import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as v from 'valibot'
import type { MCPServerConfig, DoScope, SearchResult, FetchResult } from './types.js'

describe('createMCPServer', () => {
  // Mock search function
  const mockSearch = vi.fn<[string], Promise<SearchResult[]>>()

  // Mock fetch function
  const mockFetch = vi.fn<[string], Promise<FetchResult | null>>()

  // Test DoScope
  const testDoScope: DoScope = {
    bindings: {
      testFn: () => 'test result',
    },
    types: 'declare function testFn(): string;',
    timeout: 5000,
  }

  // Test config
  const testConfig: MCPServerConfig = {
    search: mockSearch,
    fetch: mockFetch,
    do: testDoScope,
  }

  beforeEach(() => {
    mockSearch.mockReset()
    mockFetch.mockReset()
  })

  describe('factory function', () => {
    it('should be exported from the module', async () => {
      const { createMCPServer } = await import('./server.js')
      expect(createMCPServer).toBeDefined()
      expect(typeof createMCPServer).toBe('function')
    })

    it('should accept MCPServerConfig and return a server instance', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      expect(server).toBeDefined()
      expect(typeof server).toBe('object')
    })

    it('should return server with getHttpHandler method', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      expect(server.getHttpHandler).toBeDefined()
      expect(typeof server.getHttpHandler).toBe('function')
    })

    it('should return server with isConnected method', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      expect(server.isConnected).toBeDefined()
      expect(typeof server.isConnected).toBe('function')
      // mcp-lite is always "connected" since it's HTTP-based
      expect(server.isConnected()).toBe(true)
    })
  })

  describe('tool registration', () => {
    it('should register search tool', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      // The server should have the search tool registered
      const tools = server.getRegisteredTools()
      expect(tools).toContain('search')
    })

    it('should register fetch tool', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      const tools = server.getRegisteredTools()
      expect(tools).toContain('fetch')
    })

    it('should register do tool', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      const tools = server.getRegisteredTools()
      expect(tools).toContain('do')
    })
  })

  describe('search tool execution', () => {
    it('should call search function with query', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      mockSearch.mockResolvedValueOnce([
        { id: '1', title: 'Result 1', description: 'Description 1' },
      ])

      const result = await server.callTool('search', { query: 'test query' })

      expect(mockSearch).toHaveBeenCalledWith('test query', expect.objectContaining({}))
      expect(result).toEqual([
        { id: '1', title: 'Result 1', description: 'Description 1' },
      ])
    })

    it('should return search results', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      const expectedResults: SearchResult[] = [
        { id: '1', title: 'First', description: 'First result' },
        { id: '2', title: 'Second', description: 'Second result', score: 0.9 },
      ]
      mockSearch.mockResolvedValueOnce(expectedResults)

      const result = await server.callTool('search', { query: 'test' })

      expect(result).toEqual(expectedResults)
    })

    it('should handle empty search results', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      mockSearch.mockResolvedValueOnce([])

      const result = await server.callTool('search', { query: 'no matches' })

      expect(result).toEqual([])
    })
  })

  describe('fetch tool execution', () => {
    it('should call fetch function with id', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      const expectedResult: FetchResult = {
        id: 'doc-1',
        content: 'Document content',
        metadata: { type: 'document' },
      }
      mockFetch.mockResolvedValueOnce(expectedResult)

      const result = await server.callTool('fetch', { id: 'doc-1' })

      expect(mockFetch).toHaveBeenCalledWith('doc-1', expect.objectContaining({}))
      expect(result).toEqual(expectedResult)
    })

    it('should return null for not found', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      mockFetch.mockResolvedValueOnce(null)

      const result = await server.callTool('fetch', { id: 'nonexistent' })

      expect(result).toBeNull()
    })
  })

  describe('do tool execution', () => {
    it('should execute code and return DoResult format', async () => {
      // Use server-node.js for Node.js environments (has Miniflare fallback)
      const { createMCPServer } = await import('./server-node.js')
      const server = createMCPServer(testConfig)

      // Execute simple code that returns a value
      const result = await server.callTool('do', { code: 'return 42' }) as { success: boolean; value: unknown; duration: number }

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('value')
      expect(result).toHaveProperty('duration')
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
    })

    it('should pass timeout to evaluate', async () => {
      // Use server-node.js for Node.js environments (has Miniflare fallback)
      const { createMCPServer } = await import('./server-node.js')
      const configWithTimeout: MCPServerConfig = {
        ...testConfig,
        do: {
          ...testDoScope,
          timeout: 5000,
        },
      }
      const server = createMCPServer(configWithTimeout)

      // Test that code execution works and returns a result with duration
      const result = await server.callTool('do', { code: 'return 42' }) as { success: boolean; value: unknown; duration: number }
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('value')
      expect(result).toHaveProperty('duration')
      expect(result.success).toBe(true)
    })
  })

  describe('MCPServer interface', () => {
    it('should expose underlying McpServer instance', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      // Should have access to the underlying MCP server
      expect(server.server).toBeDefined()
    })
  })

  describe('input validation with Valibot', () => {
    describe('search tool validation', () => {
      it('should reject non-string query', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Passing a number instead of string for query
        await expect(
          server.callTool('search', { query: 123 })
        ).rejects.toThrow()
      })

      it('should reject missing query', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Missing required query parameter
        await expect(
          server.callTool('search', {})
        ).rejects.toThrow()
      })

      it('should reject non-number limit', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Passing a string instead of number for limit
        await expect(
          server.callTool('search', { query: 'test', limit: 'ten' })
        ).rejects.toThrow()
      })
    })

    describe('fetch tool validation', () => {
      it('should reject non-string id', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Passing a number instead of string for id
        await expect(
          server.callTool('fetch', { id: 123 })
        ).rejects.toThrow()
      })

      it('should reject missing id', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Missing required id parameter
        await expect(
          server.callTool('fetch', {})
        ).rejects.toThrow()
      })

      it('should reject non-boolean includeMetadata', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Passing a string instead of boolean for includeMetadata
        await expect(
          server.callTool('fetch', { id: 'test', includeMetadata: 'yes' })
        ).rejects.toThrow()
      })
    })

    describe('do tool validation', () => {
      it('should reject non-string code', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Passing a number instead of string for code
        await expect(
          server.callTool('do', { code: 123 })
        ).rejects.toThrow()
      })

      it('should reject missing code', async () => {
        const { createMCPServer } = await import('./server.js')
        const server = createMCPServer(testConfig)

        // Missing required code parameter
        await expect(
          server.callTool('do', {})
        ).rejects.toThrow()
      })
    })
  })

  describe('auth configuration', () => {
    it('should accept auth config', async () => {
      const { createMCPServer } = await import('./server.js')
      const configWithAuth: MCPServerConfig = {
        ...testConfig,
        auth: {
          mode: 'anon',
        },
      }
      const server = createMCPServer(configWithAuth)

      expect(server).toBeDefined()
      expect(server.getRegisteredTools()).toContain('search')
    })

    it('should make auth config available via getAuthConfig', async () => {
      const { createMCPServer } = await import('./server.js')
      const configWithAuth: MCPServerConfig = {
        ...testConfig,
        auth: {
          mode: 'anon',
        },
      }
      const server = createMCPServer(configWithAuth)

      // Server should provide access to auth config
      expect(server.getAuthConfig()).toEqual({ mode: 'anon' })
    })

    it('should return undefined for getAuthConfig when no auth configured', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      expect(server.getAuthConfig()).toBeUndefined()
    })
  })
})

describe('createToolRegistrar', () => {
  it('should be exported from the module', async () => {
    const { createToolRegistrar } = await import('./server.js')
    expect(createToolRegistrar).toBeDefined()
    expect(typeof createToolRegistrar).toBe('function')
  })

  it('should return a registrar object with registerTool method', async () => {
    const { createToolRegistrar } = await import('./server.js')
    const { McpServer } = await import('mcp-lite')
    const { toJsonSchema } = await import('@valibot/to-json-schema')

    const mcpServer = new McpServer({
      name: 'test',
      version: '0.1.0',
      schemaAdapter: (schema) => toJsonSchema(schema as v.GenericSchema),
    })
    const registrar = createToolRegistrar(mcpServer)

    expect(registrar).toHaveProperty('registerTool')
    expect(typeof registrar.registerTool).toBe('function')
  })

  it('should track registered tool names', async () => {
    const { createToolRegistrar } = await import('./server.js')
    const { McpServer } = await import('mcp-lite')
    const { toJsonSchema } = await import('@valibot/to-json-schema')

    const mcpServer = new McpServer({
      name: 'test',
      version: '0.1.0',
      schemaAdapter: (schema) => toJsonSchema(schema as v.GenericSchema),
    })
    const registrar = createToolRegistrar(mcpServer)

    registrar.registerTool('test-tool', {
      description: 'A test tool',
      inputSchema: v.object({ query: v.string() }),
      mcpHandler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
      directHandler: async () => 'ok',
    })

    expect(registrar.getRegisteredTools()).toContain('test-tool')
  })

  it('should allow direct tool calls via callTool', async () => {
    const { createToolRegistrar } = await import('./server.js')
    const { McpServer } = await import('mcp-lite')
    const { toJsonSchema } = await import('@valibot/to-json-schema')

    const mcpServer = new McpServer({
      name: 'test',
      version: '0.1.0',
      schemaAdapter: (schema) => toJsonSchema(schema as v.GenericSchema),
    })
    const registrar = createToolRegistrar(mcpServer)

    registrar.registerTool('echo', {
      description: 'Echo tool',
      inputSchema: v.object({ message: v.string() }),
      mcpHandler: async (args) => ({ content: [{ type: 'text' as const, text: args.message as string }] }),
      directHandler: async (args) => args.message,
    })

    const result = await registrar.callTool('echo', { message: 'hello' })
    expect(result).toBe('hello')
  })

  it('should throw for unknown tool in callTool', async () => {
    const { createToolRegistrar } = await import('./server.js')
    const { McpServer } = await import('mcp-lite')
    const { toJsonSchema } = await import('@valibot/to-json-schema')

    const mcpServer = new McpServer({
      name: 'test',
      version: '0.1.0',
      schemaAdapter: (schema) => toJsonSchema(schema as v.GenericSchema),
    })
    const registrar = createToolRegistrar(mcpServer)

    await expect(
      registrar.callTool('nonexistent', {})
    ).rejects.toThrow('Unknown tool: nonexistent')
  })
})
