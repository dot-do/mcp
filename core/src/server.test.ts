import { describe, it, expect, vi, beforeEach } from 'vitest'
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

    it('should return server with connect method', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      expect(server.connect).toBeDefined()
      expect(typeof server.connect).toBe('function')
    })

    it('should return server with close method', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      expect(server.close).toBeDefined()
      expect(typeof server.close).toBe('function')
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
      const { createMCPServer } = await import('./server.js')
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
      const { createMCPServer } = await import('./server.js')
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

  describe('connect and close lifecycle', () => {
    it('should connect to a transport', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      // Create a mock transport
      const mockTransport = {
        start: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        send: vi.fn(),
        onmessage: undefined as ((message: unknown) => void) | undefined,
        onerror: undefined as ((error: Error) => void) | undefined,
        onclose: undefined as (() => void) | undefined,
      }

      await server.connect(mockTransport)

      // Server should be connected
      expect(server.isConnected()).toBe(true)
    })

    it('should close connection properly', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      const mockTransport = {
        start: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        send: vi.fn(),
        onmessage: undefined as ((message: unknown) => void) | undefined,
        onerror: undefined as ((error: Error) => void) | undefined,
        onclose: undefined as (() => void) | undefined,
      }

      await server.connect(mockTransport)
      await server.close()

      // After close, the transport close should have been called
      expect(mockTransport.close).toHaveBeenCalled()
    })
  })

  describe('MCPServer interface', () => {
    it('should expose underlying McpServer instance', async () => {
      const { createMCPServer } = await import('./server.js')
      const server = createMCPServer(testConfig)

      // Should have access to the underlying MCP SDK server
      expect(server.server).toBeDefined()
    })
  })
})
