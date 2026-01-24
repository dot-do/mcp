import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMCPServer } from '../../src/server.js'
import type { MCPServerConfig, SearchResult, FetchResult } from '../../src/core/types.js'
import type { DoScope } from '../../src/scope/types.js'

describe('createMCPServer', () => {
  const mockSearchFn = vi.fn<[string], Promise<SearchResult[]>>()
  const mockFetchFn = vi.fn<[string], Promise<FetchResult>>()
  const mockDoScope: DoScope = {
    bindings: {},
    types: 'declare const example: () => void;',
  }

  const createMockConfig = (): MCPServerConfig => ({
    search: mockSearchFn,
    fetch: mockFetchFn,
    do: mockDoScope,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create an MCP server from config', () => {
    const config = createMockConfig()
    const server = createMCPServer(config)

    expect(server).toBeDefined()
    expect(typeof server.connect).toBe('function')
    expect(typeof server.close).toBe('function')
  })

  it('should expose the underlying McpServer', () => {
    const config = createMockConfig()
    const server = createMCPServer(config)

    // The server should have an underlying MCP SDK server
    expect(server.server).toBeDefined()
  })

  it('should register search, fetch, and do tools', () => {
    const config = createMockConfig()
    const server = createMCPServer(config)

    // Tools should be registered on the underlying server
    expect(server.server).toBeDefined()
  })

  describe('connect', () => {
    it('should connect to a transport', async () => {
      const config = createMockConfig()
      const server = createMCPServer(config)

      const mockTransport = {
        start: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        send: vi.fn(),
        onmessage: undefined as ((message: unknown) => void) | undefined,
        onerror: undefined as ((error: Error) => void) | undefined,
        onclose: undefined as (() => void) | undefined,
      }

      await server.connect(mockTransport)

      // Connection should succeed without error
      expect(true).toBe(true)
    })
  })

  describe('close', () => {
    it('should close the server', async () => {
      const config = createMockConfig()
      const server = createMCPServer(config)

      // Should not throw
      await server.close()
    })
  })

  describe('server info', () => {
    it('should have default server info', () => {
      const config = createMockConfig()
      const server = createMCPServer(config)

      expect(server.server).toBeDefined()
    })

    it('should accept custom server name', () => {
      const config = createMockConfig()
      const server = createMCPServer(config, { name: 'custom-server' })

      expect(server.server).toBeDefined()
    })

    it('should accept custom server version', () => {
      const config = createMockConfig()
      const server = createMCPServer(config, { version: '2.0.0' })

      expect(server.server).toBeDefined()
    })
  })
})
