/**
 * Tool Registration Tests
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createToolRegistry,
  registerTools,
  getToolDefinitions,
  createToolCallHandler,
  type Tool,
  type ToolHandler,
  type ToolsConfig,
} from './registration.js'
import type { SearchFunction, FetchFunction } from '../types.js'
import type { DoScope } from '../scope/types.js'

describe('Tool Registration', () => {
  describe('createToolRegistry', () => {
    it('should create an empty registry', () => {
      const registry = createToolRegistry()

      expect(registry.list()).toHaveLength(0)
      expect(Object.keys(registry.tools)).toHaveLength(0)
      expect(Object.keys(registry.handlers)).toHaveLength(0)
    })

    it('should register a tool', () => {
      const registry = createToolRegistry()
      const tool: Tool = {
        name: 'test',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      }
      const handler: ToolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      })

      registry.register(tool, handler)

      expect(registry.tools.test).toEqual(tool)
      expect(registry.handlers.test).toBe(handler)
    })

    it('should list registered tools', () => {
      const registry = createToolRegistry()
      const tool1: Tool = {
        name: 'tool1',
        description: 'Tool 1',
        inputSchema: { type: 'object', properties: {}, required: [] },
      }
      const tool2: Tool = {
        name: 'tool2',
        description: 'Tool 2',
        inputSchema: { type: 'object', properties: {}, required: [] },
      }
      const handler: ToolHandler = vi.fn()

      registry.register(tool1, handler)
      registry.register(tool2, handler)

      const list = registry.list()
      expect(list).toHaveLength(2)
      expect(list.map((t) => t.name)).toContain('tool1')
      expect(list.map((t) => t.name)).toContain('tool2')
    })

    it('should get handler by name', () => {
      const registry = createToolRegistry()
      const tool: Tool = {
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object', properties: {}, required: [] },
      }
      const handler: ToolHandler = vi.fn()

      registry.register(tool, handler)

      expect(registry.getHandler('test')).toBe(handler)
    })

    it('should return undefined for unknown tool', () => {
      const registry = createToolRegistry()

      expect(registry.getHandler('unknown')).toBeUndefined()
    })
  })

  describe('registerTools', () => {
    const mockSearch: SearchFunction = vi.fn().mockResolvedValue([])
    const mockFetch: FetchFunction = vi.fn().mockResolvedValue(null)
    const mockDoScope: DoScope = {
      bindings: {},
      types: '',
      timeout: 5000,
    }

    it('should register search, fetch, and do tools', () => {
      const config: ToolsConfig = {
        search: mockSearch,
        fetch: mockFetch,
        do: mockDoScope,
      }

      const registry = registerTools(config)

      const tools = registry.list()
      expect(tools.map((t) => t.name)).toContain('search')
      expect(tools.map((t) => t.name)).toContain('fetch')
      expect(tools.map((t) => t.name)).toContain('do')
    })

    it('should have handlers for all tools', () => {
      const config: ToolsConfig = {
        search: mockSearch,
        fetch: mockFetch,
        do: mockDoScope,
      }

      const registry = registerTools(config)

      expect(registry.getHandler('search')).toBeDefined()
      expect(registry.getHandler('fetch')).toBeDefined()
      expect(registry.getHandler('do')).toBeDefined()
    })

    it('should call search function through handler', async () => {
      const searchFn = vi.fn().mockResolvedValue([])
      const config: ToolsConfig = {
        search: searchFn,
        fetch: mockFetch,
        do: mockDoScope,
      }

      const registry = registerTools(config)
      const handler = registry.getHandler('search')!

      await handler({ query: 'test' })

      expect(searchFn).toHaveBeenCalledWith('test')
    })

    it('should call fetch function through handler', async () => {
      const fetchFn = vi.fn().mockResolvedValue(null)
      const config: ToolsConfig = {
        search: mockSearch,
        fetch: fetchFn,
        do: mockDoScope,
      }

      const registry = registerTools(config)
      const handler = registry.getHandler('fetch')!

      await handler({ resource: 'doc-123' })

      expect(fetchFn).toHaveBeenCalledWith('doc-123')
    })
  })

  describe('getToolDefinitions', () => {
    it('should return tool definitions from registry', () => {
      const registry = createToolRegistry()
      const tool: Tool = {
        name: 'test',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {}, required: [] },
      }
      registry.register(tool, vi.fn())

      const definitions = getToolDefinitions(registry)

      expect(definitions).toHaveLength(1)
      expect(definitions[0]).toEqual(tool)
    })
  })

  describe('createToolCallHandler', () => {
    it('should route to correct tool handler', async () => {
      const registry = createToolRegistry()
      const searchHandler: ToolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'search result' }],
      })
      const fetchHandler: ToolHandler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'fetch result' }],
      })

      registry.register(
        {
          name: 'search',
          description: 'Search',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        searchHandler
      )
      registry.register(
        {
          name: 'fetch',
          description: 'Fetch',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        fetchHandler
      )

      const callHandler = createToolCallHandler(registry)

      await callHandler('search', { query: 'test' })
      expect(searchHandler).toHaveBeenCalledWith({ query: 'test' })

      await callHandler('fetch', { resource: 'doc' })
      expect(fetchHandler).toHaveBeenCalledWith({ resource: 'doc' })
    })

    it('should return error for unknown tool', async () => {
      const registry = createToolRegistry()
      const callHandler = createToolCallHandler(registry)

      const result = await callHandler('unknown', {})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool: unknown')
    })

    it('should pass through handler response', async () => {
      const registry = createToolRegistry()
      const expectedResponse = {
        content: [{ type: 'text', text: 'custom response' }],
        isError: false,
      }
      const handler: ToolHandler = vi.fn().mockResolvedValue(expectedResponse)

      registry.register(
        {
          name: 'custom',
          description: 'Custom',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        handler
      )

      const callHandler = createToolCallHandler(registry)
      const result = await callHandler('custom', {})

      expect(result).toEqual(expectedResponse)
    })
  })
})
